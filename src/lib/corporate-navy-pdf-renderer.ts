/**
 * Corporate Navy — dedicated direct jsPDF page-aware renderer.
 *
 * Replaces the previous DOM capture / tall-canvas / slice export path.
 * Page 1 draws a full-width navy header, then immediately uses the body
 * for PROFESSIONAL SUMMARY (never leave page 1 blank after the header).
 */
import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';

const A4_W = 210;
const A4_H = 297;

type Pdf = InstanceType<typeof import('jspdf').jsPDF>;

export type CorporateNavyDirectPdfContext = {
  pdf: Pdf;
  cv: CVData;
  locale: Locale;
  labels: ReturnType<typeof getCorporateNavyPdfLabels>;
  contentX: number;
  contentW: number;
  marginTop: number;
  marginBottom: number;
  bottomSafeY: number;
  y: number;
  pageIndex: number;
  headerDrawn: boolean;
};

type Style = {
  size: number;
  color: [number, number, number];
  bold?: boolean;
  italic?: boolean;
  lineH: number;
  font?: 'times' | 'helvetica';
};

type BulletUnit = { lines: string[] };

export type CnBulletLayout = {
  markerX: number;
  textX: number;
  wrapW: number;
};

const NAVY: [number, number, number] = [15, 23, 42];
const BLUE: [number, number, number] = [59, 130, 246];
const LIGHT_BLUE: [number, number, number] = [147, 197, 253];
const TEXT: [number, number, number] = [17, 24, 39];
const BODY: [number, number, number] = [55, 65, 81];
const MUTED: [number, number, number] = [107, 114, 128];
const CONTACT: [number, number, number] = [203, 213, 225];
const RULE: [number, number, number] = [219, 234, 254];
const CHIP_BG: [number, number, number] = [241, 245, 249];
const CHIP_TEXT: [number, number, number] = [51, 65, 85];

const MARGIN_X = 16;
const MARGIN_TOP_CONT = 16;
const MARGIN_BOTTOM = 14;
const BODY_AFTER_HEADER = 14;
const BODY_LINE = 3.7;
const BULLET_LH = 3.6;
const BULLET_MARKER_GAP = 1.5;
const SECTION_H = 7.5;
const PHOTO_R = 14;
const SPARSE_LOWER_THRESHOLD_MM = 55;
const SKILLS_COL_RATIO = 0.58;

export function getCorporateNavyPdfLabels(locale: Locale) {
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
 * PDF-only text cleanup. Does not mutate saved CV data.
 */
export function cnNormalizePdfText(text: string): string {
  if (!text) return '';
  let out = text.replace(/\r\n/g, '\n');

  const protect: Array<{ token: string; stub: string }> = [
    { token: 'Node.js', stub: '\u0001NODEJS\u0001' },
    { token: 'node.js', stub: '\u0001nodejs\u0001' },
    { token: 'Express.js', stub: '\u0001EXPRESSJS\u0001' },
    { token: 'Next.js', stub: '\u0001NEXTJS\u0001' },
    { token: 'Vue.js', stub: '\u0001VUEJS\u0001' },
    { token: 'CI/CD', stub: '\u0001CICD\u0001' },
    { token: 'REST APIs', stub: '\u0001RESTAPIS\u0001' },
    { token: 'REST API', stub: '\u0001RESTAPI\u0001' },
  ];
  for (const p of protect) out = out.split(p.token).join(p.stub);

  out = out.replace(/([a-z])\.([A-Z])/g, '$1. $2');
  out = out.replace(/([a-z])\.([A-Z])/g, '$1. $2');
  out = out.replace(/\.([a-z]{3,})\.(\s*)([A-Z])/g, '. $1. $3');
  out = out.replace(
    /\.([ \t]*)(lead|logic|applied|environments|built|designed|assisted)(?=\.?[A-Z])/gi,
    '. $2',
  );
  out = out.replace(/([a-z])\.([A-Z])/g, '$1. $2');
  out = out.replace(/\.([a-z]{3,})\.(\s*)([A-Z])/g, '. $1. $3');

  for (const p of protect) out = out.split(p.stub).join(p.token);
  return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

function setStyle(ctx: CorporateNavyDirectPdfContext, s: Style): void {
  const family = s.font ?? 'helvetica';
  let style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
  if (s.bold && s.italic) style = 'bolditalic';
  else if (s.bold) style = 'bold';
  else if (s.italic) style = 'italic';
  ctx.pdf.setFont(family, style);
  ctx.pdf.setFontSize(s.size);
  ctx.pdf.setTextColor(s.color[0], s.color[1], s.color[2]);
}

export function cnMeasureWrappedLines(
  ctx: CorporateNavyDirectPdfContext,
  text: string,
  maxW: number,
): string[] {
  const t = cnNormalizePdfText(text);
  if (!t) return [];
  const r = ctx.pdf.splitTextToSize(t, maxW);
  return Array.isArray(r) ? r.map(String) : [String(r)];
}

export function cnMeasureBlockHeight(lineCount: number, lineH: number, pad = 0): number {
  if (lineCount <= 0) return pad;
  return lineCount * lineH + pad;
}

function freshCap(ctx: CorporateNavyDirectPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

export function cnCreateContext(
  pdf: Pdf,
  cv: CVData,
  locale: Locale,
): CorporateNavyDirectPdfContext {
  return {
    pdf,
    cv,
    locale,
    labels: getCorporateNavyPdfLabels(locale),
    contentX: MARGIN_X,
    contentW: A4_W - MARGIN_X * 2,
    marginTop: MARGIN_TOP_CONT,
    marginBottom: MARGIN_BOTTOM,
    bottomSafeY: A4_H - MARGIN_BOTTOM,
    y: MARGIN_TOP_CONT,
    pageIndex: 0,
    headerDrawn: false,
  };
}

export function cnAddPage(ctx: CorporateNavyDirectPdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
}

export function cnEnsureSpace(ctx: CorporateNavyDirectPdfContext, h: number): void {
  if (ctx.y + h <= ctx.bottomSafeY) return;
  cnAddPage(ctx);
}

export function cnMoveToFreshPageIfNeeded(ctx: CorporateNavyDirectPdfContext, h: number): void {
  if (h > freshCap(ctx)) return;
  if (ctx.y + h > ctx.bottomSafeY) cnAddPage(ctx);
}

function splitBullets(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => cnNormalizePdfText(l.replace(/^(?:[-*]|\u2022|\d+\.)\s*/, '')))
    .filter(Boolean);
}

function buildBullets(ctx: CorporateNavyDirectPdfContext, raw: string, contentW: number): BulletUnit[] {
  const { wrapW } = cnBulletTextLayout(ctx, contentW);
  return splitBullets(raw).map((b) => ({
    lines: cnMeasureWrappedLines(ctx, b, wrapW),
  }));
}

export function cnBulletTextLayout(
  ctx: CorporateNavyDirectPdfContext,
  contentW: number,
): CnBulletLayout {
  setStyle(ctx, { size: 9, color: BLUE, font: 'helvetica', lineH: BULLET_LH });
  const markerW = ctx.pdf.getTextWidth('-');
  const markerX = ctx.contentX;
  const textX = markerX + markerW + BULLET_MARKER_GAP;
  const wrapW = contentW - (textX - markerX);
  return { markerX, textX, wrapW: Math.max(8, wrapW) };
}

export function cnMeasureBulletHeight(lineCount: number): number {
  if (lineCount <= 0) return 0;
  return lineCount * BULLET_LH + 0.4;
}

function bulletH(unit: BulletUnit): number {
  return cnMeasureBulletHeight(unit.lines.length);
}

function headerContacts(ctx: CorporateNavyDirectPdfContext): string[] {
  const region = regionSettings[ctx.cv.region];
  const contacts = [
    ctx.cv.personal.email,
    ctx.cv.personal.phone,
    region.showAddress ? ctx.cv.personal.address : '',
    ctx.cv.personal.dateOfBirth,
    ctx.cv.personal.nationality,
  ].filter(Boolean) as string[];
  if (ctx.cv.personal.fathersName) contacts.push(ctx.cv.personal.fathersName);
  return contacts;
}

export function cnDrawHeader(
  ctx: CorporateNavyDirectPdfContext,
  photoDataUrl: string | null,
): void {
  const headerH = photoDataUrl ? 50 : 40;
  ctx.pdf.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  ctx.pdf.rect(0, 0, A4_W, headerH, 'F');

  const textLeft = MARGIN_X;
  const textMaxW = photoDataUrl
    ? A4_W - MARGIN_X * 2 - PHOTO_R * 2 - 10
    : ctx.contentW;
  let ty = 10;

  const name = ctx.cv.personal.fullName || 'Your Name';
  setStyle(ctx, {
    size: 17,
    color: [255, 255, 255],
    bold: true,
    font: 'helvetica',
    lineH: 6,
  });
  const nameLines = cnMeasureWrappedLines(ctx, name, textMaxW).slice(0, 2);
  for (const ln of nameLines) {
    ctx.pdf.text(ln, textLeft, ty + 4.5);
    ty += 5.8;
  }

  if (ctx.cv.personal.jobTitle) {
    setStyle(ctx, {
      size: 10,
      color: LIGHT_BLUE,
      bold: true,
      font: 'helvetica',
      lineH: 4,
    });
    const titleLines = cnMeasureWrappedLines(ctx, ctx.cv.personal.jobTitle, textMaxW).slice(0, 2);
    for (const ln of titleLines) {
      ctx.pdf.text(ln, textLeft, ty + 3);
      ty += 4.2;
    }
  }

  const contacts = headerContacts(ctx);
  if (contacts.length) {
    ty += 2;
    setStyle(ctx, { size: 8, color: CONTACT, font: 'helvetica', lineH: 3.4 });
    const parts: string[] = [];
    for (let i = 0; i < contacts.length; i += 1) {
      if (i > 0) parts.push('|');
      parts.push(contacts[i]!);
    }
    const contactText = parts.join('  ');
    for (const ln of cnMeasureWrappedLines(ctx, contactText, textMaxW).slice(0, 2)) {
      ctx.pdf.text(ln, textLeft, ty + 2.5);
      ty += 3.5;
    }
  }

  if (photoDataUrl) {
    const cx = A4_W - MARGIN_X - PHOTO_R;
    const cy = headerH / 2;
    try {
      ctx.pdf.setFillColor(255, 255, 255);
      ctx.pdf.circle(cx, cy, PHOTO_R + 0.6, 'F');
      ctx.pdf.addImage(
        photoDataUrl,
        'JPEG',
        cx - PHOTO_R,
        cy - PHOTO_R,
        PHOTO_R * 2,
        PHOTO_R * 2,
        undefined,
        'FAST',
      );
      ctx.pdf.setDrawColor(30, 41, 59);
      ctx.pdf.setLineWidth(1.8);
      ctx.pdf.circle(cx, cy, PHOTO_R + 0.3, 'S');
    } catch {
      ctx.pdf.setDrawColor(30, 41, 59);
      ctx.pdf.setLineWidth(1.8);
      ctx.pdf.circle(cx, cy, PHOTO_R, 'S');
    }
  }

  // Thin blue accent rule under the full-width header
  ctx.pdf.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  ctx.pdf.rect(0, headerH, A4_W, 0.7, 'F');

  ctx.headerDrawn = true;
  // CRITICAL: body starts immediately under the header — never leave page 1 blank.
  ctx.y = headerH + BODY_AFTER_HEADER;
}

export function cnDrawSectionHeading(
  ctx: CorporateNavyDirectPdfContext,
  label: string,
  opts: { x?: number; w?: number } = {},
): void {
  const x = opts.x ?? ctx.contentX;
  const w = opts.w ?? ctx.contentW;
  cnEnsureSpace(ctx, SECTION_H + 2);
  setStyle(ctx, {
    size: 8.5,
    color: NAVY,
    bold: true,
    font: 'helvetica',
    lineH: 3.5,
  });
  const text = label.toUpperCase();
  ctx.pdf.text(text, x, ctx.y + 3);
  ctx.y += 4.2;
  ctx.pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(x, ctx.y, x + w, ctx.y);
  ctx.y += 3.2;
}

export function cnDrawWrappedText(
  ctx: CorporateNavyDirectPdfContext,
  lines: string[],
  style: Style,
  opts: { x?: number } = {},
): void {
  const x = opts.x ?? ctx.contentX;
  for (const line of lines) {
    cnEnsureSpace(ctx, style.lineH);
    setStyle(ctx, style);
    ctx.pdf.text(line, x, ctx.y + style.size * 0.32);
    ctx.y += style.lineH;
  }
}

export function cnDrawSummary(ctx: CorporateNavyDirectPdfContext): void {
  if (!ctx.cv.summary) return;
  const style: Style = {
    size: 9.5,
    color: BODY,
    font: 'helvetica',
    lineH: BODY_LINE,
  };
  const lines = cnMeasureWrappedLines(ctx, ctx.cv.summary, ctx.contentW);
  if (!lines.length) return;

  const keep = Math.min(3, lines.length);
  cnMoveToFreshPageIfNeeded(ctx, SECTION_H + keep * style.lineH);
  cnDrawSectionHeading(ctx, ctx.labels.summary);

  for (const line of lines) {
    if (ctx.y + style.lineH > ctx.bottomSafeY) cnAddPage(ctx);
    setStyle(ctx, style);
    ctx.pdf.text(line, ctx.contentX, ctx.y + style.size * 0.32);
    ctx.y += style.lineH;
  }
  ctx.y += 4;
}

function measureLeadH(ctx: CorporateNavyDirectPdfContext, entry: CVData['experience'][number]): number {
  const posLines = cnMeasureWrappedLines(ctx, entry.position || '', ctx.contentW - 42);
  return Math.max(4.2, posLines.length * 4.2) + 3.8;
}

export function cnDrawContinuationHeader(
  ctx: CorporateNavyDirectPdfContext,
  entry: CVData['experience'][number],
): void {
  cnEnsureSpace(ctx, 5);
  const role = entry.position || entry.company || 'Experience';
  setStyle(ctx, { size: 8.2, color: MUTED, bold: true, font: 'helvetica', lineH: 3.4 });
  const label = `${cnNormalizePdfText(role)} (continued)`;
  ctx.pdf.text(label, ctx.contentX, ctx.y + 2.5);
  ctx.y += 5;
}

function drawExperienceLead(
  ctx: CorporateNavyDirectPdfContext,
  entry: CVData['experience'][number],
): void {
  const date = [entry.startDate, entry.isPresent ? ctx.labels.present : entry.endDate]
    .filter(Boolean)
    .join(' - ');

  setStyle(ctx, { size: 10.5, color: TEXT, bold: true, font: 'helvetica', lineH: 4.2 });
  const posLines = cnMeasureWrappedLines(ctx, entry.position || '', ctx.contentW - 42);
  const startY = ctx.y;
  let ty = startY;
  for (const ln of posLines) {
    ctx.pdf.text(ln, ctx.contentX, ty + 3.2);
    ty += 4.2;
  }

  if (date) {
    setStyle(ctx, { size: 8.2, color: MUTED, font: 'helvetica', lineH: 3.2 });
    const dw = ctx.pdf.getTextWidth(date);
    ctx.pdf.text(date, ctx.contentX + ctx.contentW - dw, startY + 3);
  }

  if (entry.company) {
    setStyle(ctx, { size: 9.5, color: BLUE, bold: true, font: 'helvetica', lineH: 3.6 });
    ctx.pdf.text(cnNormalizePdfText(entry.company), ctx.contentX, ty + 2.8);
    ty += 3.8;
  }

  ctx.y = ty + 1.5;
}

export function cnDrawWrappedBullet(
  ctx: CorporateNavyDirectPdfContext,
  lines: string[],
  layout: CnBulletLayout,
  opts: { drawMarkerOnFirstLine?: boolean } = {},
): void {
  const drawMarkerOnFirstLine = opts.drawMarkerOnFirstLine ?? true;
  const style: Style = { size: 9, color: BODY, font: 'helvetica', lineH: BULLET_LH };
  for (let i = 0; i < lines.length; i += 1) {
    cnEnsureSpace(ctx, BULLET_LH);
    if (i === 0 && drawMarkerOnFirstLine) {
      setStyle(ctx, { size: 9, color: BLUE, font: 'helvetica', lineH: BULLET_LH });
      ctx.pdf.text('-', layout.markerX, ctx.y + 2.8);
    }
    setStyle(ctx, style);
    ctx.pdf.text(lines[i]!, layout.textX, ctx.y + 2.8);
    ctx.y += BULLET_LH;
  }
}

export function cnDrawBulletAtomic(
  ctx: CorporateNavyDirectPdfContext,
  unit: BulletUnit,
  entry: CVData['experience'][number],
  continuation: { shown: boolean },
): void {
  if (!unit.lines.length) return;
  const layout = cnBulletTextLayout(ctx, ctx.contentW - 4);
  const h = cnMeasureBulletHeight(unit.lines.length);

  if (ctx.y + h > ctx.bottomSafeY && h <= freshCap(ctx)) {
    cnAddPage(ctx);
    if (!continuation.shown) {
      cnDrawContinuationHeader(ctx, entry);
      continuation.shown = true;
    }
  }

  let lineIndex = 0;
  while (lineIndex < unit.lines.length) {
    const remaining = unit.lines.length - lineIndex;
    const room = Math.floor((ctx.bottomSafeY - ctx.y) / BULLET_LH);
    if (room <= 0) {
      cnAddPage(ctx);
      if (!continuation.shown) {
        cnDrawContinuationHeader(ctx, entry);
        continuation.shown = true;
      }
      continue;
    }
    const take = Math.min(remaining, room);
    const chunk = unit.lines.slice(lineIndex, lineIndex + take);
    cnDrawWrappedBullet(ctx, chunk, layout, {
      drawMarkerOnFirstLine: lineIndex === 0,
    });
    lineIndex += take;
    if (lineIndex < unit.lines.length) {
      cnAddPage(ctx);
      if (!continuation.shown) {
        cnDrawContinuationHeader(ctx, entry);
        continuation.shown = true;
      }
    }
  }
  ctx.y += 0.4;
}

export function cnDrawExperienceEntryPaginated(
  ctx: CorporateNavyDirectPdfContext,
  entry: CVData['experience'][number],
): void {
  const bullets = buildBullets(ctx, entry.description || '', ctx.contentW - 4);
  const leadH = measureLeadH(ctx, entry);
  const firstBh = bullets[0] ? bulletH(bullets[0]) : 0;
  const keepH = leadH + Math.min(firstBh, BULLET_LH * 2);

  if (ctx.y + keepH > ctx.bottomSafeY && keepH <= freshCap(ctx)) cnAddPage(ctx);

  drawExperienceLead(ctx, entry);
  const continuation = { shown: false };
  for (const unit of bullets) {
    cnDrawBulletAtomic(ctx, unit, entry, continuation);
  }
  ctx.y += 3.5;
}

export function cnDrawExperienceSection(ctx: CorporateNavyDirectPdfContext): void {
  if (!ctx.cv.experience.length) return;
  const first = ctx.cv.experience[0]!;
  const leadH = measureLeadH(ctx, first);
  const bullets = buildBullets(ctx, first.description || '', ctx.contentW - 4);
  const firstBh = bullets[0] ? bulletH(bullets[0]) : 0;
  cnMoveToFreshPageIfNeeded(ctx, SECTION_H + leadH + Math.min(firstBh, BULLET_LH * 2));
  cnDrawSectionHeading(ctx, ctx.labels.experience);
  for (const entry of ctx.cv.experience) {
    cnDrawExperienceEntryPaginated(ctx, entry);
  }
}

export function cnDrawEducationSection(ctx: CorporateNavyDirectPdfContext): void {
  if (!ctx.cv.education.length) return;
  const firstH = 10;
  cnMoveToFreshPageIfNeeded(ctx, SECTION_H + firstH);
  cnDrawSectionHeading(ctx, ctx.labels.education);

  for (const edu of ctx.cv.education) {
    cnMoveToFreshPageIfNeeded(ctx, 10);
    const date = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');

    setStyle(ctx, { size: 10, color: TEXT, bold: true, font: 'helvetica', lineH: 4 });
    const degree = cnNormalizePdfText(edu.degree || '');
    ctx.pdf.text(degree, ctx.contentX, ctx.y + 3);
    if (date) {
      setStyle(ctx, { size: 8.2, color: MUTED, font: 'helvetica', lineH: 3.2 });
      const dw = ctx.pdf.getTextWidth(date);
      ctx.pdf.text(date, ctx.contentX + ctx.contentW - dw, ctx.y + 3);
    }
    ctx.y += 4.2;

    if (edu.school) {
      setStyle(ctx, { size: 9, color: MUTED, font: 'helvetica', lineH: 3.4 });
      ctx.pdf.text(cnNormalizePdfText(edu.school), ctx.contentX, ctx.y + 2.5);
      ctx.y += 4;
    }
    if (edu.description) {
      const lines = cnMeasureWrappedLines(ctx, edu.description, ctx.contentW);
      cnDrawWrappedText(ctx, lines, {
        size: 8.5,
        color: BODY,
        font: 'helvetica',
        lineH: 3.4,
      });
    }
    ctx.y += 2;
  }
}

type Chip = { text: string; w: number };

export function cnLayoutSkillChips(
  ctx: CorporateNavyDirectPdfContext,
  skills: string[],
  maxW: number,
): Chip[] {
  setStyle(ctx, { size: 8.2, color: CHIP_TEXT, font: 'helvetica', lineH: 3.2 });
  return skills.map((raw) => {
    const text = getLocalizedCvSkillName(raw, ctx.locale) || raw;
    const w = Math.min(maxW, ctx.pdf.getTextWidth(text) + 5);
    return { text, w };
  });
}

function measureChipRows(chips: Chip[], maxW: number): number {
  const rowH = 6.2;
  let x = 0;
  let rows = 1;
  for (const chip of chips) {
    if (x > 0 && x + chip.w > maxW) {
      rows += 1;
      x = 0;
    }
    x += chip.w + 2.2;
  }
  return rows * rowH;
}

function measureSkillsColumnH(
  ctx: CorporateNavyDirectPdfContext,
  colW: number,
): number {
  if (!ctx.cv.skills.length) return 0;
  const chips = cnLayoutSkillChips(ctx, ctx.cv.skills, colW);
  return SECTION_H + measureChipRows(chips, colW) + 2;
}

function measureLangsColumnH(ctx: CorporateNavyDirectPdfContext): number {
  if (!ctx.cv.languages.length) return 0;
  return SECTION_H + ctx.cv.languages.length * 4.2 + 2;
}

function drawSkillChipsInColumn(
  ctx: CorporateNavyDirectPdfContext,
  colX: number,
  colW: number,
  startY: number,
): number {
  if (!ctx.cv.skills.length) return startY;
  const savedY = ctx.y;
  ctx.y = startY;
  cnDrawSectionHeading(ctx, ctx.labels.skills, { x: colX, w: colW });

  const chips = cnLayoutSkillChips(ctx, ctx.cv.skills, colW);
  const rowH = 6.2;
  let x = colX;
  let rowY = ctx.y;

  const newRow = () => {
    rowY += rowH;
    x = colX;
  };

  for (const chip of chips) {
    if (x > colX && x + chip.w > colX + colW) newRow();
    ctx.pdf.setFillColor(CHIP_BG[0], CHIP_BG[1], CHIP_BG[2]);
    ctx.pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    ctx.pdf.setLineWidth(0.15);
    ctx.pdf.rect(x, rowY, chip.w, 5.2, 'FD');
    setStyle(ctx, { size: 8.2, color: CHIP_TEXT, font: 'helvetica', lineH: 3.2 });
    ctx.pdf.text(chip.text, x + 2.4, rowY + 3.5);
    x += chip.w + 2.2;
  }
  const endY = rowY + rowH + 1;
  ctx.y = savedY;
  return endY;
}

function drawLanguagesInColumn(
  ctx: CorporateNavyDirectPdfContext,
  colX: number,
  colW: number,
  startY: number,
): number {
  if (!ctx.cv.languages.length) return startY;
  const savedY = ctx.y;
  ctx.y = startY;
  cnDrawSectionHeading(ctx, ctx.labels.languages, { x: colX, w: colW });

  let rowY = ctx.y;
  for (const lang of ctx.cv.languages) {
    const name = getLocalizedCvLanguageName(lang.name, ctx.locale) || lang.name;
    setStyle(ctx, { size: 9, color: BODY, font: 'helvetica', lineH: 3.6 });
    ctx.pdf.text(name, colX, rowY + 2.8);
    if (lang.level) {
      setStyle(ctx, { size: 8.5, color: MUTED, font: 'helvetica', lineH: 3.6 });
      const levelText = `/ ${lang.level}`;
      const lw = ctx.pdf.getTextWidth(levelText);
      ctx.pdf.text(levelText, colX + colW - lw, rowY + 2.8);
    }
    rowY += 4.2;
  }
  const endY = rowY + 1.5;
  ctx.y = savedY;
  return endY;
}

/**
 * Keep Skills + Languages together when the combined block fits;
 * avoid stranding them on a nearly empty final page when possible.
 */
export function cnRebalanceLowerSections(ctx: CorporateNavyDirectPdfContext): void {
  const hasSkills = ctx.cv.skills.length > 0;
  const hasLangs = ctx.cv.languages.length > 0;
  if (!hasSkills && !hasLangs) return;

  const gap = 6;
  const skillsW = hasLangs ? ctx.contentW * SKILLS_COL_RATIO : ctx.contentW;
  const skillsH = hasSkills ? measureSkillsColumnH(ctx, skillsW) : 0;
  const langsH = hasLangs ? measureLangsColumnH(ctx) : 0;
  const total = Math.max(skillsH, langsH);

  const remaining = ctx.bottomSafeY - ctx.y;
  if (total <= remaining) return;
  if (total <= freshCap(ctx) && remaining < SPARSE_LOWER_THRESHOLD_MM) {
    cnAddPage(ctx);
  }
}

export function cnDrawSkillsLanguagesGroup(ctx: CorporateNavyDirectPdfContext): void {
  const hasSkills = ctx.cv.skills.length > 0;
  const hasLangs = ctx.cv.languages.length > 0;
  if (!hasSkills && !hasLangs) return;

  cnRebalanceLowerSections(ctx);

  const gap = 6;
  const skillsW = hasLangs ? ctx.contentW * SKILLS_COL_RATIO : ctx.contentW;
  const langsW = hasSkills ? ctx.contentW * (1 - SKILLS_COL_RATIO) - gap : ctx.contentW;
  const skillsX = ctx.contentX;
  const langsX = ctx.contentX + skillsW + gap;
  const skillsH = hasSkills ? measureSkillsColumnH(ctx, skillsW) : 0;
  const langsH = hasLangs ? measureLangsColumnH(ctx) : 0;
  const combined = Math.max(skillsH, langsH);

  if (combined > ctx.bottomSafeY - ctx.y && combined <= freshCap(ctx)) {
    cnAddPage(ctx);
  }

  const startY = ctx.y;
  let skillsEnd = startY;
  let langsEnd = startY;

  if (hasSkills) {
    skillsEnd = drawSkillChipsInColumn(ctx, skillsX, skillsW, startY);
  }
  if (hasLangs) {
    langsEnd = drawLanguagesInColumn(ctx, langsX, langsW, startY);
  }

  ctx.y = Math.max(skillsEnd, langsEnd);
}

function cnDrawCertifications(ctx: CorporateNavyDirectPdfContext): void {
  if (!ctx.cv.certifications.length) return;
  cnMoveToFreshPageIfNeeded(ctx, SECTION_H + 6);
  cnDrawSectionHeading(ctx, ctx.labels.certifications);
  for (const cert of ctx.cv.certifications) {
    const lines = cnMeasureWrappedLines(ctx, cnNormalizePdfText(cert), ctx.contentW);
    cnDrawWrappedText(ctx, lines, { size: 9, color: BODY, font: 'helvetica', lineH: 3.6 });
  }
}

export async function buildCorporateNavyPagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ctx = cnCreateContext(pdf, cv, locale);

  cnDrawHeader(ctx, options.photoDataUrl ?? null);
  cnDrawSummary(ctx);
  cnDrawExperienceSection(ctx);
  cnDrawEducationSection(ctx);
  cnDrawSkillsLanguagesGroup(ctx);
  cnDrawCertifications(ctx);

  const out = pdf.output('blob');
  return out instanceof Blob ? out : new Blob([out], { type: 'application/pdf' });
}
