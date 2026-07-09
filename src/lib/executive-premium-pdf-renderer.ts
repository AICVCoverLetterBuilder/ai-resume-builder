/**
 * Executive Premium — dedicated direct jsPDF renderer (full rebuild).
 *
 * Unicode-first: embeds Noto Sans for Latin Extended (Serbian/Croatian/Bosnian).
 * Page-aware layout with continuation headings and hanging-indent bullets.
 */
import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
import type { CVData } from './types';

const A4_W = 210;
const A4_H = 297;

type Pdf = InstanceType<typeof import('jspdf').jsPDF>;

export type ExecutivePremiumDirectPdfContext = {
  pdf: Pdf;
  cv: CVData;
  locale: Locale;
  labels: ReturnType<typeof getExecutivePremiumPdfLabels>;
  unicodeReady: boolean;
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
const PHOTO_R = 14;
const SPARSE_LOWER_THRESHOLD_MM = 52;

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

async function loadEpFontPayload(): Promise<{ regular: string; bold: string } | null> {
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

/** Embed Noto Sans (Latin Extended) into jsPDF — required for Serbian/Croatian/Bosnian PDF text. */
export async function epRegisterUnicodeFonts(pdf: Pdf): Promise<boolean> {
  try {
    const fonts = await loadEpFontPayload();
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

/**
 * PDF-only text cleanup. Does not mutate saved CV data.
 */
export function epNormalizePdfText(text: string): string {
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

function fontFamily(ctx: ExecutivePremiumDirectPdfContext): string {
  return ctx.unicodeReady ? 'NotoSans' : 'helvetica';
}

function setStyle(ctx: ExecutivePremiumDirectPdfContext, s: Style): void {
  const family = fontFamily(ctx);
  let style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
  if (s.bold && s.italic) style = 'bolditalic';
  else if (s.bold) style = 'bold';
  else if (s.italic) style = 'italic';
  if (style === 'italic' || style === 'bolditalic') {
    ctx.pdf.setFont(family, s.bold ? 'bold' : 'normal');
  } else {
    ctx.pdf.setFont(family, s.bold ? 'bold' : 'normal');
  }
  ctx.pdf.setFontSize(s.size);
  ctx.pdf.setTextColor(s.color[0], s.color[1], s.color[2]);
}

export function epMeasureWrappedLines(
  ctx: ExecutivePremiumDirectPdfContext,
  text: string,
  maxW: number,
): string[] {
  const t = epNormalizePdfText(text);
  if (!t) return [];
  const r = ctx.pdf.splitTextToSize(t, maxW);
  return Array.isArray(r) ? r.map(String) : [String(r)];
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
  unicodeReady: boolean,
): ExecutivePremiumDirectPdfContext {
  return {
    pdf,
    cv,
    locale,
    labels: getExecutivePremiumPdfLabels(locale),
    unicodeReady,
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

  const textLeft = MARGIN_X;
  const textMaxW = photoDataUrl ? A4_W - MARGIN_X * 2 - PHOTO_R * 2 - 10 : ctx.contentW;
  let ty = 10;

  const name = (ctx.cv.personal.fullName || 'YOUR NAME').toUpperCase();
  setStyle(ctx, { size: 18, color: [255, 255, 255], bold: true, lineH: 6.5 });
  for (const ln of epMeasureWrappedLines(ctx, name, textMaxW).slice(0, 2)) {
    ctx.pdf.text(ln, textLeft, ty + 4.5);
    ty += 6.2;
  }

  ctx.pdf.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  ctx.pdf.rect(textLeft, ty + 1, 18, 0.55, 'F');
  ty += 5;

  if (ctx.cv.personal.jobTitle) {
    setStyle(ctx, { size: 10, color: SOFT_GOLD, lineH: 4 });
    for (const ln of epMeasureWrappedLines(ctx, ctx.cv.personal.jobTitle, textMaxW).slice(0, 2)) {
      ctx.pdf.text(ln, textLeft, ty + 3);
      ty += 4;
    }
  }

  const contacts = [ctx.cv.personal.email, ctx.cv.personal.phone, ctx.cv.personal.address].filter(Boolean) as string[];
  if (contacts.length) {
    ty += 2;
    setStyle(ctx, { size: 8, color: CONTACT, lineH: 3.4 });
    for (const ln of epMeasureWrappedLines(ctx, contacts.join('  |  '), textMaxW).slice(0, 2)) {
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
      ctx.pdf.addImage(photoDataUrl, 'JPEG', cx - PHOTO_R, cy - PHOTO_R, PHOTO_R * 2, PHOTO_R * 2, undefined, 'FAST');
      ctx.pdf.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
      ctx.pdf.setLineWidth(2.2);
      ctx.pdf.circle(cx, cy, PHOTO_R + 0.3, 'S');
      ctx.pdf.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
      ctx.pdf.setLineWidth(0.45);
      ctx.pdf.circle(cx, cy, PHOTO_R + 0.65, 'S');
    } catch {
      ctx.pdf.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
      ctx.pdf.setLineWidth(0.45);
      ctx.pdf.circle(cx, cy, PHOTO_R, 'S');
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
  setStyle(ctx, {
    size: opts.compact ? 7.8 : 8.5,
    color: HEADING,
    bold: true,
    lineH: 3.5,
  });
  const text = label.toUpperCase();
  if (opts.centered) {
    const w = ctx.pdf.getTextWidth(text);
    ctx.pdf.text(text, ctx.contentX + (ctx.contentW - w) / 2, ctx.y + 3);
  } else {
    ctx.pdf.text(text, ctx.contentX, ctx.y + 3);
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
    setStyle(ctx, style);
    if (opts.centered) {
      const w = ctx.pdf.getTextWidth(line);
      ctx.pdf.text(line, ctx.contentX + (ctx.contentW - w) / 2, ctx.y + style.size * 0.32);
    } else {
      ctx.pdf.text(line, x, ctx.y + style.size * 0.32);
    }
    ctx.y += style.lineH;
  }
}

export function epDrawSummary(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.summary) return;
  const style: Style = { size: 9.5, color: BODY, italic: true, lineH: BODY_LINE };
  const lines = epMeasureWrappedLines(ctx, ctx.cv.summary, ctx.contentW);
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

function splitBullets(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => epNormalizePdfText(l.replace(/^(?:[-*]|\u2022|\d+\.)\s*/, '')))
    .filter(Boolean);
}

function epBulletTextLayout(ctx: ExecutivePremiumDirectPdfContext, maxW: number): BulletLayout {
  const markerX = ctx.contentX;
  const textX = ctx.contentX + BULLET_INDENT;
  return { markerX, textX, textW: maxW - BULLET_INDENT };
}

function buildBulletUnits(ctx: ExecutivePremiumDirectPdfContext, raw: string, maxW: number): BulletUnit[] {
  const layout = epBulletTextLayout(ctx, maxW);
  return splitBullets(raw).map((text) => ({
    lines: epMeasureWrappedLines(ctx, text, layout.textW),
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
  for (let i = 0; i < lines.length; i += 1) {
    epEnsureSpace(ctx, BULLET_LH);
    if (i === 0 && drawMarker) {
      setStyle(ctx, { size: 9, color: GOLD, lineH: BULLET_LH });
      ctx.pdf.text('-', layout.markerX, ctx.y + 2.8);
    }
    setStyle(ctx, style);
    ctx.pdf.text(lines[i]!, layout.textX, ctx.y + 2.8);
    ctx.y += BULLET_LH;
  }
}

function epMeasureExperienceLeadHeight(ctx: ExecutivePremiumDirectPdfContext, entry: CVData['experience'][number]): number {
  const posLines = epMeasureWrappedLines(ctx, entry.position || '', ctx.contentW - 42);
  let h = Math.max(4.2, posLines.length * 4.2) + 3.6;
  if (entry.company) h += 3.8;
  return h + 1.5;
}

export function epDrawExperienceEntryContinuation(
  ctx: ExecutivePremiumDirectPdfContext,
  entry: CVData['experience'][number],
): void {
  epEnsureSpace(ctx, 5);
  const role = epNormalizePdfText(entry.position || entry.company || 'Experience');
  setStyle(ctx, { size: 8.2, color: MUTED, bold: true, lineH: 3.4 });
  ctx.pdf.text(`${role} (continued)`, ctx.contentX, ctx.y + 2.5);
  ctx.y += 5;
}

function epDrawExperienceLead(ctx: ExecutivePremiumDirectPdfContext, entry: CVData['experience'][number]): void {
  const date = [entry.startDate, entry.isPresent ? ctx.labels.present : entry.endDate].filter(Boolean).join(' - ');
  setStyle(ctx, { size: 10.5, color: TEXT, bold: true, lineH: 4.2 });
  const posLines = epMeasureWrappedLines(ctx, entry.position || '', ctx.contentW - 42);
  const startY = ctx.y;
  let ty = startY;
  for (const ln of posLines) {
    ctx.pdf.text(ln, ctx.contentX, ty + 3.2);
    ty += 4.2;
  }

  if (date) {
    setStyle(ctx, { size: 8.2, color: HEADING, italic: true, lineH: 3.2 });
    const dw = ctx.pdf.getTextWidth(date);
    ctx.pdf.text(date, ctx.contentX + ctx.contentW - dw, startY + 3);
  }

  if (entry.company) {
    setStyle(ctx, { size: 9.5, color: GOLD, bold: true, lineH: 3.6 });
    ctx.pdf.text(epNormalizePdfText(entry.company), ctx.contentX, ty + 2.8);
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
    setStyle(ctx, { size: 10, color: TEXT, bold: true, lineH: 4 });
    const degree = epNormalizePdfText(edu.degree || '');
    const dw = ctx.pdf.getTextWidth(degree);
    ctx.pdf.text(degree, ctx.contentX + (ctx.contentW - dw) / 2, ctx.y + 3);
    ctx.y += 4.2;

    const meta = [edu.school, [edu.startDate, edu.endDate].filter(Boolean).join(' - ')].filter(Boolean).join(' | ');
    if (meta) {
      setStyle(ctx, { size: 8.5, color: MUTED, lineH: 3.4 });
      const mw = ctx.pdf.getTextWidth(epNormalizePdfText(meta));
      ctx.pdf.text(epNormalizePdfText(meta), ctx.contentX + (ctx.contentW - mw) / 2, ctx.y + 2.5);
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
  setStyle(ctx, { size: 9, color: BODY, lineH: 3.6 });
  const text = labels.join('  |  ');
  const lines = epMeasureWrappedLines(ctx, text, ctx.contentW);
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
    setStyle(ctx, { size: 9, color: TEXT, bold: true, lineH: 3.6 });
    ctx.pdf.text(name, ctx.contentX, ctx.y + 2.8);
    if (lang.level) {
      setStyle(ctx, { size: 8.5, color: MUTED, lineH: 3.6 });
      const lw = ctx.pdf.getTextWidth(lang.level);
      ctx.pdf.text(lang.level, ctx.contentX + ctx.contentW - lw, ctx.y + 2.8);
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
  const unicodeReady = await epRegisterUnicodeFonts(pdf);
  const ctx = epCreateContext(pdf, cv, locale, unicodeReady);

  epDrawHeader(ctx, options.photoDataUrl ?? null);
  epDrawSummary(ctx);
  epDrawExperienceSection(ctx);
  epDrawEducationSection(ctx);
  epDrawSkillsLanguagesGroup(ctx);
  epDrawCertifications(ctx);

  const out = pdf.output('blob');
  return out instanceof Blob ? out : new Blob([out], { type: 'application/pdf' });
}
