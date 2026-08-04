/**
 * Clean Simple — dedicated direct jsPDF renderer (full rebuild).
 *
 * Simple, ATS-friendly, white-background layout. No colored full-width header,
 * no navy/premium design, no Modern Minimal purple styling. Direct jsPDF only,
 * no DOM capture / html2canvas / tall-canvas slicing.
 *
 * Unicode-first: embeds Noto Sans (Latin Extended) so Serbian/Croatian/Bosnian
 * text (č ć š đ ž Č Ć Š Đ Ž) renders correctly instead of relying on jsPDF's
 * built-in Helvetica, which lacks those glyphs and silently drops/replaces them.
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
import { regionSettings, type CVData } from './types';

const A4_W = 210;
const A4_H = 297;

type Pdf = InstanceType<typeof import('jspdf').jsPDF>;

export type CleanSimplePdfContext = {
  pdf: Pdf;
  cv: CVData;
  locale: Locale;
  labels: ReturnType<typeof getCleanSimplePdfLabels>;
  i18n: PdfI18nRegistry;
  unicodeReady: boolean;
  lastTextStyle?: TextStyle;
  contentX: number;
  contentW: number;
  marginTop: number;
  marginBottom: number;
  bottomSafeY: number;
  y: number;
  pageIndex: number;
};

type TextStyle = {
  size: number;
  color: [number, number, number];
  bold?: boolean;
  lineH: number;
};

type BulletBlock = { lines: string[] };

export type CsBulletLayout = {
  markerX: number;
  textX: number;
  wrapW: number;
};

const TEXT: [number, number, number] = [17, 24, 39];
const ACCENT: [number, number, number] = [5, 150, 105];
const MUTED: [number, number, number] = [75, 85, 99];
const LIGHT: [number, number, number] = [156, 163, 175];
const RULE: [number, number, number] = [229, 231, 235];

const MARGIN_X = 14;
const MARGIN_TOP = 14;
const MARGIN_BOTTOM = 14;
const SECTION_HEADING_H = 7.2;
const BODY_LINE_H = 4.25;
const BULLET_LINE_H = 4.05;
const DATE_COL_W = 34;
const PHOTO_SIZE = 22;
const LOWER_SECTIONS_MIN_REMAINING = 40;

/** Embed multilingual Noto families into jsPDF. */
export async function csRegisterUnicodeFonts(pdf: Pdf): Promise<boolean> {
  const i18n = await registerPdfI18nFonts(pdf);
  return i18n.latinReady;
}

export function getCleanSimplePdfLabels(locale: Locale) {
  const t = translations[locale] ?? translations.en;
  return {
    summary: t.cv.summary,
    experience: t.cv.experience,
    education: t.cv.education,
    skills: t.cv.skills,
    languages: t.cv.languages,
    certifications: t.cv.certifications,
    present: t.cv.present,
  };
}

/**
 * PDF-only normalization — never mutates saved CV data. Fixes glued sentence
 * boundaries (e.g. "daIskusan" -> "da. Iskusan", "učenika.Planirao" ->
 * "učenika. Planirao") for Serbian/Croatian/Bosnian Latin Extended text, while
 * protecting technical tokens (Node.js, CI/CD, REST APIs, ...), email
 * addresses and dates from being altered.
 */
export function csNormalizePdfText(text: string, locale: Locale = 'en'): string {
  if (!text) return '';
  let out = text.replace(/\r\n/g, '\n');
  if (!shouldApplyLatinPdfSentenceFixes(locale, text)) {
    return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }

  const protect: Array<{ token: string; stub: string }> = [
    { token: 'GitHub', stub: '\u0001GITHUB\u0001' },
    { token: 'GitLab', stub: '\u0001GITLAB\u0001' },
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
  out = out.replace(new RegExp(`\\.([${latLo}]{3,})\\.(\\s*)([${latHi}])`, 'g'), '. $1. $3');
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

function applyStyle(ctx: CleanSimplePdfContext, style: TextStyle, text?: string): void {
  ctx.lastTextStyle = style;
  pdfI18nCtxApplyStyle(ctx, { size: style.size, color: style.color, bold: style.bold }, text);
}

function drawText(
  ctx: CleanSimplePdfContext,
  text: string,
  x: number,
  y: number,
  style: TextStyle,
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

function usablePageHeight(ctx: CleanSimplePdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

function remainingY(ctx: CleanSimplePdfContext): number {
  return ctx.bottomSafeY - ctx.y;
}

export function csCreateContext(
  pdf: Pdf,
  cv: CVData,
  locale: Locale,
  i18n: PdfI18nRegistry,
): CleanSimplePdfContext {
  return {
    pdf,
    cv,
    locale,
    labels: getCleanSimplePdfLabels(locale),
    i18n,
    unicodeReady: i18n.latinReady,
    contentX: MARGIN_X,
    contentW: A4_W - MARGIN_X * 2,
    marginTop: MARGIN_TOP,
    marginBottom: MARGIN_BOTTOM,
    bottomSafeY: A4_H - MARGIN_BOTTOM,
    y: MARGIN_TOP,
    pageIndex: 0,
  };
}

export function csAddPage(ctx: CleanSimplePdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
}

export function csMoveToNextPage(ctx: CleanSimplePdfContext): void {
  csAddPage(ctx);
}

export function csEnsureSpace(ctx: CleanSimplePdfContext, neededMm: number): void {
  if (ctx.y + neededMm <= ctx.bottomSafeY) return;
  csMoveToNextPage(ctx);
}

function wrapLines(ctx: CleanSimplePdfContext, text: string, maxW: number, style?: Pick<TextStyle, 'size' | 'bold'>): string[] {
  const normalized = csNormalizePdfText(text, ctx.locale);
  if (!normalized) return [];
  const wrapStyle = style ?? ctx.lastTextStyle ?? { size: 8.1, bold: false };
  return pdfI18nCtxSplit(ctx, normalized, maxW, { size: wrapStyle.size, bold: wrapStyle.bold });
}

export function csMeasureWrappedTextHeight(
  ctx: CleanSimplePdfContext,
  text: string,
  maxW: number,
  lineH: number,
): number {
  const lines = wrapLines(ctx, text, maxW);
  if (!lines.length) return 0;
  return lines.length * lineH;
}

export function csMeasureBulletHeight(lineCount: number): number {
  if (lineCount <= 0) return 0;
  return lineCount * BULLET_LINE_H;
}

function bulletLayout(ctx: CleanSimplePdfContext, contentW: number): CsBulletLayout {
  const markerStyle: TextStyle = { size: 7.65, color: MUTED, lineH: BULLET_LINE_H };
  applyStyle(ctx, markerStyle, '\u2022');
  const markerW = pdfI18nCtxTextWidth(ctx, '\u2022', { size: markerStyle.size, bold: false });
  const markerX = ctx.contentX;
  const textX = markerX + markerW + 1.6;
  return { markerX, textX, wrapW: Math.max(8, contentW - (textX - markerX)) };
}

function parseBulletLines(raw: string, locale: Locale): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => csNormalizePdfText(line.replace(/^(?:[-*]|\u2022|\d+\.)\s*/, ''), locale))
    .filter(Boolean);
}

function buildBulletBlocks(ctx: CleanSimplePdfContext, raw: string, contentW: number): BulletBlock[] {
  const layout = bulletLayout(ctx, contentW);
  return parseBulletLines(raw, ctx.locale).map((text) => ({
    lines: wrapLines(ctx, text, layout.wrapW),
  }));
}

function headerContactParts(ctx: CleanSimplePdfContext): string[] {
  const region = regionSettings[ctx.cv.region];
  return [
    ctx.cv.personal.email,
    ctx.cv.personal.phone,
    region.showAddress ? ctx.cv.personal.address : '',
  ].filter(Boolean) as string[];
}

/** White, simple header — never draws a colored full-width band. */
export function csDrawHeader(ctx: CleanSimplePdfContext, photoDataUrl: string | null): void {
  const headerTop = ctx.y;
  const textX = photoDataUrl ? ctx.contentX + PHOTO_SIZE + 5 : ctx.contentX;
  const textMaxW = ctx.contentW - (photoDataUrl ? PHOTO_SIZE + 5 : 0);

  if (photoDataUrl) {
    try {
      ctx.pdf.addImage(photoDataUrl, 'PNG', ctx.contentX, headerTop, PHOTO_SIZE, PHOTO_SIZE);
    } catch {
      try {
        ctx.pdf.addImage(photoDataUrl, 'JPEG', ctx.contentX, headerTop, PHOTO_SIZE, PHOTO_SIZE);
      } catch {
        // Keep PDF export usable if jsPDF rejects an image data URL.
      }
    }
  }

  applyStyle(ctx, { size: 16.5, color: TEXT, bold: true, lineH: 6 });
  const nameStyle: TextStyle = { size: 16.5, color: TEXT, bold: true, lineH: 6 };
  const nameLines = wrapLines(ctx, ctx.cv.personal.fullName || 'Your Name', textMaxW, nameStyle).slice(0, 2);
  let textBottom = headerTop + 5;
  for (const line of nameLines) {
    drawText(ctx, line, textX, textBottom, nameStyle);
    textBottom += 6;
  }

  if (ctx.cv.personal.jobTitle) {
    const jobStyle: TextStyle = { size: 9, color: ACCENT, lineH: 4 };
    applyStyle(ctx, jobStyle);
    const jobLines = wrapLines(ctx, ctx.cv.personal.jobTitle, textMaxW, jobStyle).slice(0, 2);
    for (const line of jobLines) {
      drawText(ctx, line, textX, textBottom, jobStyle);
      textBottom += 4;
    }
  }

  const contacts = headerContactParts(ctx);
  if (contacts.length > 0) {
    const contactStyle: TextStyle = { size: 7.8, color: MUTED, lineH: 4 };
    applyStyle(ctx, contactStyle);
    const contactLines = wrapLines(ctx, contacts.join('  |  '), textMaxW, contactStyle).slice(0, 2);
    for (const line of contactLines) {
      drawText(ctx, line, textX, textBottom, contactStyle);
      textBottom += 4;
    }
  }

  const dividerY = Math.max(textBottom + 1, headerTop + PHOTO_SIZE + 3);
  ctx.pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
  ctx.pdf.setLineWidth(0.3);
  ctx.pdf.line(ctx.contentX, dividerY, ctx.contentX + ctx.contentW, dividerY);

  ctx.y = dividerY + 8;
}

export function csDrawSectionHeading(ctx: CleanSimplePdfContext, label: string): void {
  csEnsureSpace(ctx, SECTION_HEADING_H);
  const style: TextStyle = { size: 8.25, color: ACCENT, bold: true, lineH: 4.2 };
  applyStyle(ctx, style, label);
  drawText(ctx, label.toUpperCase(), ctx.contentX, ctx.y, style);
  ctx.y += SECTION_HEADING_H;
}

export function csDrawWrappedParagraph(
  ctx: CleanSimplePdfContext,
  lines: string[],
  style: TextStyle,
  opts: { x?: number } = {},
): void {
  const x = opts.x ?? ctx.contentX;
  for (const line of lines) {
    csEnsureSpace(ctx, style.lineH);
    applyStyle(ctx, style, line);
    drawText(ctx, line, x, ctx.y, style);
    ctx.y += style.lineH;
  }
}

export function csDrawSummary(ctx: CleanSimplePdfContext): void {
  if (!ctx.cv.summary?.trim()) return;

  const bodyStyle: TextStyle = { size: 8.1, color: MUTED, lineH: BODY_LINE_H };
  const paragraphs = ctx.cv.summary
    .split(/\n\s*\n+/)
    .map(part => part.trim())
    .filter(Boolean);
  const blocks = paragraphs.length > 0 ? paragraphs : [ctx.cv.summary];
  const linesByBlock = blocks.map(block => wrapLines(ctx, block, ctx.contentW));
  const totalLines = linesByBlock.reduce((sum, lines) => sum + lines.length, 0);
  if (totalLines === 0) return;

  const previewLines = Math.min(3, totalLines);
  const keepWithHeading = SECTION_HEADING_H + previewLines * bodyStyle.lineH;
  if (keepWithHeading <= usablePageHeight(ctx) && ctx.y + keepWithHeading > ctx.bottomSafeY) {
    csMoveToNextPage(ctx);
  }

  csDrawSectionHeading(ctx, ctx.labels.summary);

  linesByBlock.forEach((lines, index) => {
    csDrawWrappedParagraph(ctx, lines, bodyStyle);
    if (index < linesByBlock.length - 1) ctx.y += 2.5;
  });
  ctx.y += 4.5;
}

export function csDrawWrappedBullet(
  ctx: CleanSimplePdfContext,
  lines: string[],
  layout: CsBulletLayout,
  opts: { drawMarker?: boolean } = {},
): void {
  const drawMarker = opts.drawMarker ?? true;
  const style: TextStyle = { size: 7.65, color: MUTED, lineH: BULLET_LINE_H };
  for (let i = 0; i < lines.length; i += 1) {
    csEnsureSpace(ctx, BULLET_LINE_H);
    if (i === 0 && drawMarker) {
      applyStyle(ctx, style, '\u2022');
      drawText(ctx, '\u2022', layout.markerX, ctx.y, style);
    }
    applyStyle(ctx, style, lines[i]!);
    drawText(ctx, lines[i]!, layout.textX, ctx.y, style);
    ctx.y += BULLET_LINE_H;
  }
}

function drawExperienceEntryContinuation(
  ctx: CleanSimplePdfContext,
  entry: CVData['experience'][number],
): void {
  csEnsureSpace(ctx, 5);
  const role = entry.position || entry.company || 'Experience';
  const contStyle: TextStyle = { size: 7.3, color: LIGHT, bold: true, lineH: 3.2 };
  const contText = `${csNormalizePdfText(role, ctx.locale)} (continued)`;
  applyStyle(ctx, contStyle, contText);
  drawText(ctx, contText, ctx.contentX, ctx.y + 2.5, contStyle);
  ctx.y += 4.5;
}

function experienceTitle(ctx: CleanSimplePdfContext, entry: CVData['experience'][number]): string {
  const position = csNormalizePdfText(entry.position || '', ctx.locale);
  const company = csNormalizePdfText(entry.company || '', ctx.locale);
  return company ? `${position} \u2014 ${company}` : position;
}

function experienceDateRange(ctx: CleanSimplePdfContext, entry: CVData['experience'][number]): string {
  return [entry.startDate, entry.isPresent ? ctx.labels.present : entry.endDate]
    .filter(Boolean)
    .join(' - ');
}

function measureExperienceLeadHeight(ctx: CleanSimplePdfContext, entry: CVData['experience'][number]): number {
  const titleLines = wrapLines(ctx, experienceTitle(ctx, entry), ctx.contentW - DATE_COL_W);
  return Math.max(4.3, titleLines.length * 4.3) + 2;
}

function drawExperienceLead(ctx: CleanSimplePdfContext, entry: CVData['experience'][number]): void {
  const date = experienceDateRange(ctx, entry);
  const titleStyle: TextStyle = { size: 8.1, color: TEXT, bold: true, lineH: 4.3 };
  applyStyle(ctx, titleStyle);
  const titleLines = wrapLines(ctx, experienceTitle(ctx, entry), ctx.contentW - DATE_COL_W, titleStyle);
  const startY = ctx.y;
  let lineY = startY;
  for (const line of titleLines) {
    drawText(ctx, line, ctx.contentX, lineY + 3.2, titleStyle);
    lineY += 4.3;
  }

  if (date) {
    const dateStyle: TextStyle = { size: 7.1, color: LIGHT, lineH: 3.5 };
    applyStyle(ctx, dateStyle, date);
    drawText(ctx, date, ctx.contentX + ctx.contentW, startY + 3.2, dateStyle, { align: 'right' });
  }

  ctx.y = lineY + 1.6;
}

function drawBulletBlock(
  ctx: CleanSimplePdfContext,
  block: BulletBlock,
  entry: CVData['experience'][number],
  state: { continuationShown: boolean },
): void {
  if (!block.lines.length) return;

  const layout = bulletLayout(ctx, ctx.contentW - 4);
  const blockH = csMeasureBulletHeight(block.lines.length);

  if (blockH <= usablePageHeight(ctx) && ctx.y + blockH > ctx.bottomSafeY) {
    csMoveToNextPage(ctx);
    drawExperienceEntryContinuation(ctx, entry);
    state.continuationShown = true;
  }

  let index = 0;
  while (index < block.lines.length) {
    const roomLines = Math.floor((ctx.bottomSafeY - ctx.y) / BULLET_LINE_H);
    if (roomLines <= 0) {
      csMoveToNextPage(ctx);
      if (!state.continuationShown) {
        drawExperienceEntryContinuation(ctx, entry);
        state.continuationShown = true;
      }
      continue;
    }

    const take = Math.min(block.lines.length - index, roomLines);
    const chunk = block.lines.slice(index, index + take);
    csDrawWrappedBullet(ctx, chunk, layout, { drawMarker: index === 0 });
    index += take;

    if (index < block.lines.length) {
      csMoveToNextPage(ctx);
      if (!state.continuationShown) {
        drawExperienceEntryContinuation(ctx, entry);
        state.continuationShown = true;
      }
    }
  }
}

export function csDrawExperienceEntry(
  ctx: CleanSimplePdfContext,
  entry: CVData['experience'][number],
): void {
  const bullets = buildBulletBlocks(ctx, entry.description || '', ctx.contentW - 4);
  const leadH = measureExperienceLeadHeight(ctx, entry);
  const firstBulletH = bullets[0] ? csMeasureBulletHeight(bullets[0].lines.length) : 0;
  const keepTogether = leadH + Math.min(firstBulletH, BULLET_LINE_H * 2);

  if (keepTogether <= usablePageHeight(ctx) && ctx.y + keepTogether > ctx.bottomSafeY) {
    csMoveToNextPage(ctx);
  }

  drawExperienceLead(ctx, entry);
  const state = { continuationShown: false };
  for (const block of bullets) {
    drawBulletBlock(ctx, block, entry, state);
  }
  ctx.y += 3.5;
}

export function csDrawExperienceSection(ctx: CleanSimplePdfContext): void {
  if (!ctx.cv.experience.length) return;

  const first = ctx.cv.experience[0]!;
  const leadH = measureExperienceLeadHeight(ctx, first);
  const bullets = buildBulletBlocks(ctx, first.description || '', ctx.contentW - 4);
  const firstBulletH = bullets[0] ? csMeasureBulletHeight(bullets[0].lines.length) : 0;
  const keepTogether = SECTION_HEADING_H + leadH + Math.min(firstBulletH, BULLET_LINE_H * 2);

  if (keepTogether <= usablePageHeight(ctx) && ctx.y + keepTogether > ctx.bottomSafeY) {
    csMoveToNextPage(ctx);
  }

  csDrawSectionHeading(ctx, ctx.labels.experience);
  for (const entry of ctx.cv.experience) {
    csDrawExperienceEntry(ctx, entry);
  }
}

function educationEntryHeight(ctx: CleanSimplePdfContext, edu: CVData['education'][number]): number {
  const degreeLines = wrapLines(ctx, edu.degree || '', ctx.contentW - DATE_COL_W);
  const schoolLines = edu.school ? wrapLines(ctx, edu.school, ctx.contentW) : [];
  return Math.max(4.3, degreeLines.length * 4.3) + schoolLines.length * 3.9 + 4;
}

function measureEducationSectionHeight(ctx: CleanSimplePdfContext): number {
  if (!ctx.cv.education.length) return 0;
  let total = SECTION_HEADING_H;
  for (const edu of ctx.cv.education) {
    total += educationEntryHeight(ctx, edu);
  }
  return total + 2;
}

function drawEducationEntry(ctx: CleanSimplePdfContext, edu: CVData['education'][number]): void {
  const entryHeight = educationEntryHeight(ctx, edu);
  if (entryHeight <= usablePageHeight(ctx) && ctx.y + entryHeight > ctx.bottomSafeY) {
    csMoveToNextPage(ctx);
  }

  const degreeStyle: TextStyle = { size: 7.9, color: TEXT, bold: true, lineH: 4.3 };
  applyStyle(ctx, degreeStyle);
  const degreeLines = wrapLines(ctx, edu.degree || '', ctx.contentW - DATE_COL_W, degreeStyle);
  const startY = ctx.y;
  let lineY = startY;
  for (const line of degreeLines) {
    drawText(ctx, line, ctx.contentX, lineY + 3.2, degreeStyle);
    lineY += 4.3;
  }

  const dateText = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
  if (dateText) {
    const dateStyle: TextStyle = { size: 7.1, color: LIGHT, lineH: 3.5 };
    applyStyle(ctx, dateStyle, dateText);
    drawText(ctx, dateText, ctx.contentX + ctx.contentW, startY + 3.2, dateStyle, { align: 'right' });
  }
  ctx.y = lineY + 0.3;

  if (edu.school) {
    const schoolLines = wrapLines(ctx, edu.school, ctx.contentW);
    csDrawWrappedParagraph(ctx, schoolLines, { size: 7.35, color: MUTED, lineH: 3.9 });
  }
  ctx.y += 3.5;
}

export function csDrawEducationSection(ctx: CleanSimplePdfContext): void {
  if (!ctx.cv.education.length) return;

  const fullHeight = measureEducationSectionHeight(ctx);
  const headingPlusFirst = SECTION_HEADING_H + educationEntryHeight(ctx, ctx.cv.education[0]!);
  const freshCapacity = usablePageHeight(ctx);
  if (fullHeight <= freshCapacity) {
    if (fullHeight <= freshCapacity && ctx.y + fullHeight > ctx.bottomSafeY) csMoveToNextPage(ctx);
  } else if (headingPlusFirst <= freshCapacity && ctx.y + headingPlusFirst > ctx.bottomSafeY) {
    csMoveToNextPage(ctx);
  }

  csDrawSectionHeading(ctx, ctx.labels.education);
  for (const edu of ctx.cv.education) {
    drawEducationEntry(ctx, edu);
  }
}

function pipeLines(ctx: CleanSimplePdfContext, items: string[]): string[] {
  return wrapLines(ctx, items.join(' | '), ctx.contentW);
}

function measureSectionWithLines(lines: string[], style: TextStyle): number {
  if (lines.length === 0) return 0;
  return SECTION_HEADING_H + lines.length * style.lineH + 4;
}

function skillsLines(ctx: CleanSimplePdfContext): string[] {
  if (!ctx.cv.skills.length) return [];
  const skills = ctx.cv.skills.map(skill => getLocalizedCvSkillName(skill, ctx.locale) || skill);
  return pipeLines(ctx, skills);
}

function languagesLines(ctx: CleanSimplePdfContext): string[] {
  if (!ctx.cv.languages.length) return [];
  const languages = ctx.cv.languages.map(
    language => `${getLocalizedCvLanguageName(language.name, ctx.locale) || language.name} (${language.level})`,
  );
  return pipeLines(ctx, languages);
}

function measureSkillsLanguagesGroupHeight(ctx: CleanSimplePdfContext): number {
  const style: TextStyle = { size: 7.65, color: MUTED, lineH: BULLET_LINE_H };
  return measureSectionWithLines(skillsLines(ctx), style) + measureSectionWithLines(languagesLines(ctx), style);
}

function drawAtomicSection(
  ctx: CleanSimplePdfContext,
  label: string,
  lines: string[],
  style: TextStyle,
  spacingAfter = 4,
): void {
  if (lines.length === 0) return;
  const blockHeight = SECTION_HEADING_H + lines.length * style.lineH + spacingAfter;
  if (blockHeight <= usablePageHeight(ctx) && ctx.y + blockHeight > ctx.bottomSafeY) {
    csMoveToNextPage(ctx);
  }
  csDrawSectionHeading(ctx, label);
  csDrawWrappedParagraph(ctx, lines, style);
  ctx.y += spacingAfter;
}

export function csDrawSkillsLanguagesGroup(ctx: CleanSimplePdfContext): void {
  const style: TextStyle = { size: 7.65, color: MUTED, lineH: BULLET_LINE_H };
  const skills = skillsLines(ctx);
  const languages = languagesLines(ctx);
  const combinedHeight = measureSectionWithLines(skills, style) + measureSectionWithLines(languages, style);
  const freshCapacity = usablePageHeight(ctx);

  if (combinedHeight > 0 && combinedHeight <= freshCapacity) {
    if (remainingY(ctx) < Math.min(combinedHeight, LOWER_SECTIONS_MIN_REMAINING)) {
      csMoveToNextPage(ctx);
    } else if (ctx.y + combinedHeight > ctx.bottomSafeY) {
      csMoveToNextPage(ctx);
    }
  }

  if (skills.length > 0) drawAtomicSection(ctx, ctx.labels.skills, skills, style);
  if (languages.length > 0) drawAtomicSection(ctx, ctx.labels.languages, languages, style);
}

function measureCertificationsHeight(ctx: CleanSimplePdfContext): number {
  if (!ctx.cv.certifications.length) return 0;
  const lines = ctx.cv.certifications.flatMap(cert => wrapLines(ctx, cert, ctx.contentW));
  return measureSectionWithLines(lines, { size: 7.65, color: MUTED, lineH: BULLET_LINE_H });
}

function drawCertifications(ctx: CleanSimplePdfContext): void {
  if (!ctx.cv.certifications.length) return;
  const lines = ctx.cv.certifications.flatMap(cert => wrapLines(ctx, cert, ctx.contentW));
  drawAtomicSection(ctx, ctx.labels.certifications, lines, { size: 7.65, color: MUTED, lineH: BULLET_LINE_H });
}

/**
 * Keeps Education + Skills/Languages (+ Certifications) grouped together when
 * the combined block is small enough to fit one fresh page. Without this,
 * Education can land on the tail of the current page (just barely fitting)
 * while Skills/Languages — measured independently right after — no longer has
 * enough remaining room and gets orphaned alone on the next page, even though
 * the whole group would have fit together starting from a clean page.
 */
export function csDrawLowerSections(ctx: CleanSimplePdfContext): void {
  const educationH = measureEducationSectionHeight(ctx);
  const skillsLangsH = measureSkillsLanguagesGroupHeight(ctx);
  const certificationsH = measureCertificationsHeight(ctx);
  const combinedH = educationH + skillsLangsH + certificationsH;
  const freshCapacity = usablePageHeight(ctx);

  if (combinedH > 0 && combinedH <= freshCapacity && ctx.y + combinedH > ctx.bottomSafeY) {
    csMoveToNextPage(ctx);
  }

  if (educationH > 0) csDrawEducationSection(ctx);
  if (skillsLangsH > 0) csDrawSkillsLanguagesGroup(ctx);
  if (certificationsH > 0) drawCertifications(ctx);
}

export async function buildCleanSimplePagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  (pdf as InstanceType<typeof jsPDF> & { allowFsRead?: string[] }).allowFsRead = ['*'];
  const i18n = await registerPdfI18nFonts(pdf);
  const ctx = csCreateContext(pdf, cv, locale, i18n);

  csDrawHeader(ctx, options.photoDataUrl ?? null);
  csDrawSummary(ctx);
  csDrawExperienceSection(ctx);
  csDrawLowerSections(ctx);

  const output = pdf.output('blob');
  return output instanceof Blob ? output : new Blob([output], { type: 'application/pdf' });
}
