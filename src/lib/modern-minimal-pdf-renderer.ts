/**
 * Modern Minimal — dedicated direct jsPDF renderer (Unicode rebuild).
 *
 * White/indigo minimal header — no dark navy fill. Direct jsPDF only, no DOM
 * capture. Embeds Noto Sans (Latin Extended) so Serbian/Croatian/Bosnian text
 * renders correctly instead of relying on jsPDF's built-in Helvetica, which
 * lacks the glyphs for č ć š đ ž and silently drops/replaces them.
 */
import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';

const A4_W = 210;
const A4_H = 297;

type Pdf = InstanceType<typeof import('jspdf').jsPDF>;

export type ModernMinimalPdfContext = {
  pdf: Pdf;
  cv: CVData;
  locale: Locale;
  labels: ReturnType<typeof getModernMinimalPdfLabels>;
  unicodeReady: boolean;
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
  italic?: boolean;
  lineH: number;
};

type BulletBlock = { lines: string[] };

export type MmBulletLayout = {
  markerX: number;
  textX: number;
  wrapW: number;
};

type ChipLayout = { text: string; w: number };

const INDIGO: [number, number, number] = [79, 70, 229];
const TEXT: [number, number, number] = [17, 24, 39];
const BODY: [number, number, number] = [55, 65, 81];
const MUTED: [number, number, number] = [107, 114, 128];
const CONTACT: [number, number, number] = [75, 85, 99];
const RULE: [number, number, number] = [199, 210, 254];
const CHIP_BG: [number, number, number] = [238, 242, 255];
const CHIP_TEXT: [number, number, number] = [67, 56, 202];

const MARGIN_X = 12;
const MARGIN_TOP = 12;
const MARGIN_BOTTOM = 14;
const GAP_AFTER_HEADER = 12;
const SECTION_HEADING_H = 7;
const BODY_LINE_H = 3.6;
const BULLET_LINE_H = 3.5;
const BULLET_GAP = 1.5;
const PHOTO_RADIUS = 13;
const DATE_COL_W = 28;
const SKILLS_COL_RATIO = 0.58;
const LOWER_SECTIONS_MIN_REMAINING = 50;

const FONT_REG_PATHS = [
  '/fonts/NotoSans-Regular.ttf',
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
];
const FONT_BOLD_PATHS = [
  '/fonts/NotoSans-Bold.ttf',
  'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
];

let cachedFontPayload: { regular: string; bold: string } | null = null;
let fontPayloadPromise: Promise<{ regular: string; bold: string } | null> | null = null;

function toB64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 1) s += String.fromCharCode(b[i]!);
  return btoa(s);
}

async function readFontBytes(urls: string[]): Promise<ArrayBuffer | null> {
  for (const url of urls) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
      const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
      if (timer) clearTimeout(timer);
      if (res.ok) return await res.arrayBuffer();
    } catch {
      // try next source
    }
  }
  return null;
}

async function loadMmFontPayload(): Promise<{ regular: string; bold: string } | null> {
  if (cachedFontPayload) return cachedFontPayload;
  if (fontPayloadPromise) return fontPayloadPromise;
  fontPayloadPromise = (async () => {
    const [regular, bold] = await Promise.all([
      readFontBytes(FONT_REG_PATHS),
      readFontBytes(FONT_BOLD_PATHS),
    ]);
    if (!regular || !bold) return null;
    cachedFontPayload = { regular: toB64(regular), bold: toB64(bold) };
    return cachedFontPayload;
  })();
  return fontPayloadPromise;
}

/** Embed Noto Sans (Latin Extended) into jsPDF — required for Serbian/Croatian/Bosnian PDF text. */
export async function mmRegisterUnicodeFonts(pdf: Pdf): Promise<boolean> {
  try {
    const fonts = await loadMmFontPayload();
    if (!fonts) return false;
    pdf.addFileToVFS('NotoSans-Regular.ttf', fonts.regular);
    pdf.addFileToVFS('NotoSans-Bold.ttf', fonts.bold);
    pdf.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
    pdf.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
    return true;
  } catch {
    return false;
  }
}

export function getModernMinimalPdfLabels(locale: Locale) {
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

/** PDF-only normalization — never mutates saved CV data. */
export function mmNormalizePdfText(text: string): string {
  if (!text) return '';
  let out = text.replace(/\r\n/g, '\n');

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

function fontFamily(ctx: ModernMinimalPdfContext): string {
  return ctx.unicodeReady ? 'NotoSans' : 'helvetica';
}

function applyStyle(ctx: ModernMinimalPdfContext, style: TextStyle): void {
  const family = fontFamily(ctx);
  ctx.pdf.setFont(family, style.bold ? 'bold' : 'normal');
  ctx.pdf.setFontSize(style.size);
  ctx.pdf.setTextColor(style.color[0], style.color[1], style.color[2]);
}

function usablePageHeight(ctx: ModernMinimalPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

function remainingY(ctx: ModernMinimalPdfContext): number {
  return ctx.bottomSafeY - ctx.y;
}

export function mmCreateContext(
  pdf: Pdf,
  cv: CVData,
  locale: Locale,
  unicodeReady: boolean,
): ModernMinimalPdfContext {
  return {
    pdf,
    cv,
    locale,
    labels: getModernMinimalPdfLabels(locale),
    unicodeReady,
    contentX: MARGIN_X,
    contentW: A4_W - MARGIN_X * 2,
    marginTop: MARGIN_TOP,
    marginBottom: MARGIN_BOTTOM,
    bottomSafeY: A4_H - MARGIN_BOTTOM,
    y: MARGIN_TOP,
    pageIndex: 0,
  };
}

export function mmAddPage(ctx: ModernMinimalPdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
}

export function mmMoveToNextPage(ctx: ModernMinimalPdfContext): void {
  mmAddPage(ctx);
}

export function mmEnsureSpace(ctx: ModernMinimalPdfContext, neededMm: number): void {
  if (ctx.y + neededMm <= ctx.bottomSafeY) return;
  mmMoveToNextPage(ctx);
}

function wrapLines(ctx: ModernMinimalPdfContext, text: string, maxW: number): string[] {
  const normalized = mmNormalizePdfText(text);
  if (!normalized) return [];
  const result = ctx.pdf.splitTextToSize(normalized, maxW);
  return Array.isArray(result) ? result.map(String) : [String(result)];
}

export function mmMeasureWrappedTextHeight(
  ctx: ModernMinimalPdfContext,
  text: string,
  maxW: number,
  lineH: number,
): number {
  const lines = wrapLines(ctx, text, maxW);
  if (!lines.length) return 0;
  return lines.length * lineH;
}

export function mmMeasureBulletHeight(lineCount: number): number {
  if (lineCount <= 0) return 0;
  return lineCount * BULLET_LINE_H + 0.3;
}

function bulletLayout(ctx: ModernMinimalPdfContext, contentW: number): MmBulletLayout {
  applyStyle(ctx, { size: 9, color: BODY, lineH: BULLET_LINE_H });
  const markerW = ctx.pdf.getTextWidth('-');
  const markerX = ctx.contentX;
  const textX = markerX + markerW + BULLET_GAP;
  return { markerX, textX, wrapW: Math.max(8, contentW - (textX - markerX)) };
}

function parseBulletLines(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => mmNormalizePdfText(line.replace(/^(?:[-*]|\u2022|\d+\.)\s*/, '')))
    .filter(Boolean);
}

function buildBulletBlocks(ctx: ModernMinimalPdfContext, raw: string, contentW: number): BulletBlock[] {
  const layout = bulletLayout(ctx, contentW);
  return parseBulletLines(raw).map((text) => ({
    lines: wrapLines(ctx, text, layout.wrapW),
  }));
}

function headerContactParts(ctx: ModernMinimalPdfContext): string[] {
  const region = regionSettings[ctx.cv.region];
  return [
    ctx.cv.personal.email,
    ctx.cv.personal.phone,
    region.showAddress ? ctx.cv.personal.address : '',
  ].filter(Boolean) as string[];
}

/** White minimal header — never draws a full-width navy band. */
export function mmDrawHeader(ctx: ModernMinimalPdfContext, photoDataUrl: string | null): void {
  const textLeft = ctx.contentX;
  const photoReserve = photoDataUrl ? PHOTO_RADIUS * 2 + 8 : 0;
  const textMaxW = ctx.contentW - photoReserve;
  let textBottom = ctx.y + 2;

  const name = ctx.cv.personal.fullName || 'Your Name';
  applyStyle(ctx, { size: 18, color: TEXT, bold: true, lineH: 6 });
  for (const line of wrapLines(ctx, name, textMaxW).slice(0, 2)) {
    ctx.pdf.text(line, textLeft, textBottom + 4.5);
    textBottom += 5.6;
  }

  if (ctx.cv.personal.jobTitle) {
    applyStyle(ctx, { size: 10.5, color: INDIGO, bold: true, lineH: 4 });
    for (const line of wrapLines(ctx, ctx.cv.personal.jobTitle, textMaxW).slice(0, 2)) {
      ctx.pdf.text(line, textLeft, textBottom + 3);
      textBottom += 4;
    }
  }

  const contacts = headerContactParts(ctx);
  if (contacts.length) {
    textBottom += 1.5;
    applyStyle(ctx, { size: 8.5, color: CONTACT, lineH: 3.3 });
    const contactLine = contacts.join('    ');
    for (const line of wrapLines(ctx, contactLine, textMaxW).slice(0, 2)) {
      ctx.pdf.text(line, textLeft, textBottom + 2.5);
      textBottom += 3.4;
    }
  }

  let photoBottom = ctx.y;
  if (photoDataUrl) {
    const cx = ctx.contentX + ctx.contentW - PHOTO_RADIUS;
    const cy = ctx.y + PHOTO_RADIUS + 1;
    photoBottom = cy + PHOTO_RADIUS;
    try {
      ctx.pdf.setFillColor(255, 255, 255);
      ctx.pdf.circle(cx, cy, PHOTO_RADIUS + 0.4, 'F');
      ctx.pdf.addImage(
        photoDataUrl,
        'JPEG',
        cx - PHOTO_RADIUS,
        cy - PHOTO_RADIUS,
        PHOTO_RADIUS * 2,
        PHOTO_RADIUS * 2,
        undefined,
        'FAST',
      );
      ctx.pdf.setDrawColor(229, 231, 235);
      ctx.pdf.setLineWidth(0.35);
      ctx.pdf.circle(cx, cy, PHOTO_RADIUS + 0.15, 'S');
    } catch {
      ctx.pdf.setDrawColor(229, 231, 235);
      ctx.pdf.setLineWidth(0.35);
      ctx.pdf.circle(cx, cy, PHOTO_RADIUS, 'S');
    }
  }

  const dividerY = Math.max(textBottom, photoBottom) + 3;
  ctx.pdf.setDrawColor(INDIGO[0], INDIGO[1], INDIGO[2]);
  ctx.pdf.setLineWidth(0.55);
  ctx.pdf.line(ctx.contentX, dividerY, ctx.contentX + ctx.contentW, dividerY);

  ctx.y = dividerY + GAP_AFTER_HEADER;
}

export function mmDrawSectionHeading(
  ctx: ModernMinimalPdfContext,
  label: string,
  opts: { x?: number; w?: number } = {},
): void {
  const x = opts.x ?? ctx.contentX;
  const w = opts.w ?? ctx.contentW;
  mmEnsureSpace(ctx, SECTION_HEADING_H + 2);
  applyStyle(ctx, { size: 8.5, color: INDIGO, bold: true, lineH: 3.4 });
  ctx.pdf.text(label.toUpperCase(), x, ctx.y + 3);
  ctx.y += 4;
  ctx.pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(x, ctx.y, x + w, ctx.y);
  ctx.y += 3;
}

export function mmDrawWrappedParagraph(
  ctx: ModernMinimalPdfContext,
  lines: string[],
  style: TextStyle,
  opts: { x?: number } = {},
): void {
  const x = opts.x ?? ctx.contentX;
  for (const line of lines) {
    mmEnsureSpace(ctx, style.lineH);
    applyStyle(ctx, style);
    ctx.pdf.text(line, x, ctx.y + style.size * 0.32);
    ctx.y += style.lineH;
  }
}

export function mmDrawSummary(ctx: ModernMinimalPdfContext): void {
  if (!ctx.cv.summary?.trim()) return;

  const bodyStyle: TextStyle = { size: 9.2, color: BODY, lineH: BODY_LINE_H };
  const lines = wrapLines(ctx, ctx.cv.summary, ctx.contentW);
  if (!lines.length) return;

  const previewLines = Math.min(3, lines.length);
  const keepWithHeading = SECTION_HEADING_H + previewLines * bodyStyle.lineH;
  if (keepWithHeading <= usablePageHeight(ctx) && ctx.y + keepWithHeading > ctx.bottomSafeY) {
    mmMoveToNextPage(ctx);
  }

  mmDrawSectionHeading(ctx, ctx.labels.summary);

  for (const line of lines) {
    if (ctx.y + bodyStyle.lineH > ctx.bottomSafeY) mmMoveToNextPage(ctx);
    applyStyle(ctx, bodyStyle);
    ctx.pdf.text(line, ctx.contentX, ctx.y + bodyStyle.size * 0.32);
    ctx.y += bodyStyle.lineH;
  }
  ctx.y += 3;
}

export function mmDrawWrappedBullet(
  ctx: ModernMinimalPdfContext,
  lines: string[],
  layout: MmBulletLayout,
  opts: { drawMarker?: boolean } = {},
): void {
  const drawMarker = opts.drawMarker ?? true;
  const style: TextStyle = { size: 9, color: BODY, lineH: BULLET_LINE_H };
  for (let i = 0; i < lines.length; i += 1) {
    mmEnsureSpace(ctx, BULLET_LINE_H);
    if (i === 0 && drawMarker) {
      applyStyle(ctx, style);
      ctx.pdf.text('-', layout.markerX, ctx.y + 2.6);
    }
    applyStyle(ctx, style);
    ctx.pdf.text(lines[i]!, layout.textX, ctx.y + 2.6);
    ctx.y += BULLET_LINE_H;
  }
}

export function mmDrawExperienceEntryContinuation(
  ctx: ModernMinimalPdfContext,
  entry: CVData['experience'][number],
): void {
  mmEnsureSpace(ctx, 5);
  const role = entry.position || entry.company || 'Experience';
  applyStyle(ctx, { size: 8, color: MUTED, bold: true, lineH: 3.2 });
  ctx.pdf.text(`${mmNormalizePdfText(role)} (continued)`, ctx.contentX, ctx.y + 2.5);
  ctx.y += 4.5;
}

function measureExperienceLeadHeight(ctx: ModernMinimalPdfContext, entry: CVData['experience'][number]): number {
  const positionLines = wrapLines(ctx, entry.position || '', ctx.contentW - DATE_COL_W);
  const companyH = entry.company ? 3.4 : 0;
  return Math.max(4, positionLines.length * 4) + companyH + 2;
}

function drawExperienceLead(ctx: ModernMinimalPdfContext, entry: CVData['experience'][number]): void {
  const date = [entry.startDate, entry.isPresent ? ctx.labels.present : entry.endDate]
    .filter(Boolean)
    .join(' - ');

  applyStyle(ctx, { size: 10, color: TEXT, bold: true, lineH: 4 });
  const positionLines = wrapLines(ctx, entry.position || '', ctx.contentW - DATE_COL_W);
  const startY = ctx.y;
  let lineY = startY;
  for (const line of positionLines) {
    ctx.pdf.text(line, ctx.contentX, lineY + 3);
    lineY += 4;
  }

  if (date) {
    applyStyle(ctx, { size: 8, color: MUTED, lineH: 3.2 });
    const dateW = ctx.pdf.getTextWidth(date);
    ctx.pdf.text(date, ctx.contentX + ctx.contentW - dateW, startY + 3);
  }

  if (entry.company) {
    applyStyle(ctx, { size: 9, color: MUTED, lineH: 3.4 });
    ctx.pdf.text(mmNormalizePdfText(entry.company), ctx.contentX, lineY + 2.6);
    lineY += 3.4;
  }

  ctx.y = lineY + 1;
}

function drawBulletBlock(
  ctx: ModernMinimalPdfContext,
  block: BulletBlock,
  entry: CVData['experience'][number],
  state: { continuationShown: boolean },
): void {
  if (!block.lines.length) return;

  const layout = bulletLayout(ctx, ctx.contentW - 4);
  const blockH = mmMeasureBulletHeight(block.lines.length);

  if (blockH <= usablePageHeight(ctx) && ctx.y + blockH > ctx.bottomSafeY) {
    mmMoveToNextPage(ctx);
    mmDrawExperienceEntryContinuation(ctx, entry);
    state.continuationShown = true;
  }

  let index = 0;
  while (index < block.lines.length) {
    const roomLines = Math.floor((ctx.bottomSafeY - ctx.y) / BULLET_LINE_H);
    if (roomLines <= 0) {
      mmMoveToNextPage(ctx);
      if (!state.continuationShown) {
        mmDrawExperienceEntryContinuation(ctx, entry);
        state.continuationShown = true;
      }
      continue;
    }

    const take = Math.min(block.lines.length - index, roomLines);
    const chunk = block.lines.slice(index, index + take);
    mmDrawWrappedBullet(ctx, chunk, layout, { drawMarker: index === 0 });
    index += take;

    if (index < block.lines.length) {
      mmMoveToNextPage(ctx);
      if (!state.continuationShown) {
        mmDrawExperienceEntryContinuation(ctx, entry);
        state.continuationShown = true;
      }
    }
  }
  ctx.y += 0.3;
}

export function mmDrawExperienceEntry(
  ctx: ModernMinimalPdfContext,
  entry: CVData['experience'][number],
): void {
  const bullets = buildBulletBlocks(ctx, entry.description || '', ctx.contentW - 4);
  const leadH = measureExperienceLeadHeight(ctx, entry);
  const firstBulletH = bullets[0] ? mmMeasureBulletHeight(bullets[0].lines.length) : 0;
  const keepTogether = leadH + Math.min(firstBulletH, BULLET_LINE_H * 2);

  if (keepTogether <= usablePageHeight(ctx) && ctx.y + keepTogether > ctx.bottomSafeY) {
    mmMoveToNextPage(ctx);
  }

  drawExperienceLead(ctx, entry);
  const state = { continuationShown: false };
  for (const block of bullets) {
    drawBulletBlock(ctx, block, entry, state);
  }
  ctx.y += 2.5;
}

export function mmDrawExperienceSection(ctx: ModernMinimalPdfContext): void {
  if (!ctx.cv.experience.length) return;

  const first = ctx.cv.experience[0]!;
  const leadH = measureExperienceLeadHeight(ctx, first);
  const bullets = buildBulletBlocks(ctx, first.description || '', ctx.contentW - 4);
  const firstBulletH = bullets[0] ? mmMeasureBulletHeight(bullets[0].lines.length) : 0;
  const keepTogether = SECTION_HEADING_H + leadH + Math.min(firstBulletH, BULLET_LINE_H * 2);

  if (keepTogether <= usablePageHeight(ctx) && ctx.y + keepTogether > ctx.bottomSafeY) {
    mmMoveToNextPage(ctx);
  }

  mmDrawSectionHeading(ctx, ctx.labels.experience);
  for (const entry of ctx.cv.experience) {
    mmDrawExperienceEntry(ctx, entry);
  }
}

export function mmDrawEducationSection(ctx: ModernMinimalPdfContext): void {
  if (!ctx.cv.education.length) return;

  const firstRowH = 8;
  if (firstRowH + SECTION_HEADING_H <= usablePageHeight(ctx)
    && ctx.y + SECTION_HEADING_H + firstRowH > ctx.bottomSafeY) {
    mmMoveToNextPage(ctx);
  }

  mmDrawSectionHeading(ctx, ctx.labels.education);

  for (const edu of ctx.cv.education) {
    const rowH = 8 + (edu.description
      ? mmMeasureWrappedTextHeight(ctx, edu.description, ctx.contentW, 3.3)
      : 0);
    if (rowH <= usablePageHeight(ctx) && ctx.y + rowH > ctx.bottomSafeY) {
      mmMoveToNextPage(ctx);
    }

    const date = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
    const label = [edu.degree, edu.school].filter(Boolean).join(' / ');

    applyStyle(ctx, { size: 9.8, color: TEXT, bold: true, lineH: 3.8 });
    const labelLines = wrapLines(ctx, label, ctx.contentW - DATE_COL_W);
    const startY = ctx.y;
    let lineY = startY;
    for (const line of labelLines) {
      ctx.pdf.text(line, ctx.contentX, lineY + 3);
      lineY += 3.8;
    }

    if (date) {
      applyStyle(ctx, { size: 8, color: MUTED, lineH: 3.2 });
      const dateW = ctx.pdf.getTextWidth(date);
      ctx.pdf.text(date, ctx.contentX + ctx.contentW - dateW, startY + 3);
    }
    ctx.y = lineY + 1.2;

    if (edu.description) {
      const descLines = wrapLines(ctx, edu.description, ctx.contentW);
      mmDrawWrappedParagraph(ctx, descLines, {
        size: 8.5,
        color: BODY,
        lineH: 3.3,
      });
    }
    ctx.y += 1.2;
  }
}

export function mmLayoutSkillChips(
  ctx: ModernMinimalPdfContext,
  skills: string[],
  maxW: number,
): ChipLayout[] {
  applyStyle(ctx, { size: 8, color: CHIP_TEXT, lineH: 3.1 });
  return skills.map((raw) => {
    const text = getLocalizedCvSkillName(raw, ctx.locale) || raw;
    const w = Math.min(maxW, ctx.pdf.getTextWidth(text) + 5.5);
    return { text, w };
  });
}

function measureChipRows(chips: ChipLayout[], maxW: number): number {
  const rowH = 5.8;
  let x = 0;
  let rows = 1;
  for (const chip of chips) {
    if (x > 0 && x + chip.w > maxW) {
      rows += 1;
      x = 0;
    }
    x += chip.w + 2;
  }
  return rows * rowH;
}

function measureSkillsBlockH(ctx: ModernMinimalPdfContext, colW: number): number {
  if (!ctx.cv.skills.length) return 0;
  const chips = mmLayoutSkillChips(ctx, ctx.cv.skills, colW);
  return SECTION_HEADING_H + measureChipRows(chips, colW) + 2;
}

function measureLanguagesBlockH(ctx: ModernMinimalPdfContext): number {
  if (!ctx.cv.languages.length) return 0;
  return SECTION_HEADING_H + ctx.cv.languages.length * 4 + 2;
}

/** Mirrors the row-height approximation mmDrawEducationSection uses when paginating. */
function mmMeasureEducationSectionHeight(ctx: ModernMinimalPdfContext): number {
  if (!ctx.cv.education.length) return 0;
  let total = SECTION_HEADING_H;
  for (const edu of ctx.cv.education) {
    total += 8 + (edu.description
      ? mmMeasureWrappedTextHeight(ctx, edu.description, ctx.contentW, 3.3)
      : 0);
  }
  return total;
}

function mmMeasureSkillsLanguagesGroupHeight(ctx: ModernMinimalPdfContext): number {
  const hasSkills = ctx.cv.skills.length > 0;
  const hasLangs = ctx.cv.languages.length > 0;
  if (!hasSkills && !hasLangs) return 0;
  const skillsW = hasLangs ? ctx.contentW * SKILLS_COL_RATIO : ctx.contentW;
  const skillsH = hasSkills ? measureSkillsBlockH(ctx, skillsW) : 0;
  const langsH = hasLangs ? measureLanguagesBlockH(ctx) : 0;
  return Math.max(skillsH, langsH);
}

export function mmMeasureLowerSectionsHeight(ctx: ModernMinimalPdfContext): number {
  let total = mmMeasureEducationSectionHeight(ctx) + mmMeasureSkillsLanguagesGroupHeight(ctx);
  if (ctx.cv.certifications.length) {
    total += SECTION_HEADING_H + ctx.cv.certifications.length * 4;
  }
  return total;
}

function drawSkillChipsColumn(
  ctx: ModernMinimalPdfContext,
  colX: number,
  colW: number,
  startY: number,
): number {
  if (!ctx.cv.skills.length) return startY;
  const savedY = ctx.y;
  ctx.y = startY;
  mmDrawSectionHeading(ctx, ctx.labels.skills, { x: colX, w: colW });

  const chips = mmLayoutSkillChips(ctx, ctx.cv.skills, colW);
  const rowH = 5.8;
  let x = colX;
  let rowY = ctx.y;

  for (const chip of chips) {
    if (x > colX && x + chip.w > colX + colW) {
      rowY += rowH;
      x = colX;
    }
    ctx.pdf.setFillColor(CHIP_BG[0], CHIP_BG[1], CHIP_BG[2]);
    ctx.pdf.setDrawColor(CHIP_BG[0], CHIP_BG[1], CHIP_BG[2]);
    ctx.pdf.setLineWidth(0.1);
    ctx.pdf.roundedRect(x, rowY, chip.w, 4.8, 2.4, 2.4, 'F');
    applyStyle(ctx, { size: 8, color: CHIP_TEXT, lineH: 3.1 });
    ctx.pdf.text(chip.text, x + 2.2, rowY + 3.2);
    x += chip.w + 2;
  }

  const endY = rowY + rowH + 1;
  ctx.y = savedY;
  return endY;
}

function drawLanguagesColumn(
  ctx: ModernMinimalPdfContext,
  colX: number,
  colW: number,
  startY: number,
): number {
  if (!ctx.cv.languages.length) return startY;
  const savedY = ctx.y;
  ctx.y = startY;
  mmDrawSectionHeading(ctx, ctx.labels.languages, { x: colX, w: colW });

  let rowY = ctx.y;
  for (const lang of ctx.cv.languages) {
    const name = getLocalizedCvLanguageName(lang.name, ctx.locale) || lang.name;
    const line = lang.level ? `${name} - ${lang.level}` : name;
    applyStyle(ctx, { size: 9, color: BODY, lineH: 3.5 });
    ctx.pdf.text(mmNormalizePdfText(line), colX, rowY + 2.6);
    rowY += 4;
  }

  const endY = rowY + 1;
  ctx.y = savedY;
  return endY;
}

export function mmDrawSkillsLanguagesGroup(ctx: ModernMinimalPdfContext): void {
  const hasSkills = ctx.cv.skills.length > 0;
  const hasLangs = ctx.cv.languages.length > 0;
  if (!hasSkills && !hasLangs) return;

  const gap = 6;
  const skillsW = hasLangs ? ctx.contentW * SKILLS_COL_RATIO : ctx.contentW;
  const langsW = hasSkills ? ctx.contentW * (1 - SKILLS_COL_RATIO) - gap : ctx.contentW;
  const skillsX = ctx.contentX;
  const langsX = ctx.contentX + skillsW + gap;
  const blockH = Math.max(
    hasSkills ? measureSkillsBlockH(ctx, skillsW) : 0,
    hasLangs ? measureLanguagesBlockH(ctx) : 0,
  );

  if (blockH <= usablePageHeight(ctx) && remainingY(ctx) < Math.min(blockH, LOWER_SECTIONS_MIN_REMAINING)) {
    mmMoveToNextPage(ctx);
  }
  if (blockH <= usablePageHeight(ctx) && ctx.y + blockH > ctx.bottomSafeY) {
    mmMoveToNextPage(ctx);
  }

  const startY = ctx.y;
  const skillsEnd = hasSkills ? drawSkillChipsColumn(ctx, skillsX, skillsW, startY) : startY;
  const langsEnd = hasLangs ? drawLanguagesColumn(ctx, langsX, langsW, startY) : startY;
  ctx.y = Math.max(skillsEnd, langsEnd);
}

/**
 * Keeps Education + Skills/Languages grouped together when the combined block
 * is small enough to fit one fresh page. Without this, Education can land on
 * the tail of the current page (just barely fitting) while Skills/Languages —
 * measured independently right after — no longer has enough remaining room
 * and gets orphaned alone on the next page, even though the whole group
 * would have fit together starting from a clean page.
 */
export function mmDrawLowerSections(ctx: ModernMinimalPdfContext): void {
  const educationH = mmMeasureEducationSectionHeight(ctx);
  const skillsLangsH = mmMeasureSkillsLanguagesGroupHeight(ctx);

  if (educationH > 0 && skillsLangsH > 0) {
    const combinedH = educationH + skillsLangsH;
    const fitsOnFreshPage = combinedH <= usablePageHeight(ctx);
    const fitsOnCurrentPage = ctx.y + combinedH <= ctx.bottomSafeY;
    if (fitsOnFreshPage && !fitsOnCurrentPage) {
      mmMoveToNextPage(ctx);
    }
  }

  mmDrawEducationSection(ctx);
  mmDrawSkillsLanguagesGroup(ctx);
}

function mmDrawCertifications(ctx: ModernMinimalPdfContext): void {
  if (!ctx.cv.certifications.length) return;
  mmEnsureSpace(ctx, SECTION_HEADING_H + 6);
  mmDrawSectionHeading(ctx, ctx.labels.certifications);
  for (const cert of ctx.cv.certifications) {
    const lines = wrapLines(ctx, cert, ctx.contentW);
    mmDrawWrappedParagraph(ctx, lines, { size: 9, color: BODY, lineH: 3.5 });
  }
}

export async function buildModernMinimalPagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const unicodeReady = await mmRegisterUnicodeFonts(pdf);
  const ctx = mmCreateContext(pdf, cv, locale, unicodeReady);

  mmDrawHeader(ctx, options.photoDataUrl ?? null);
  mmDrawSummary(ctx);
  mmDrawExperienceSection(ctx);
  mmDrawLowerSections(ctx);
  mmDrawCertifications(ctx);

  const out = pdf.output('blob');
  return out instanceof Blob ? out : new Blob([out], { type: 'application/pdf' });
}
