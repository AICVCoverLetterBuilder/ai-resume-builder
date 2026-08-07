/**
 * Rirekisho / Japanese CV — hybrid content-flow direct jsPDF renderer.
 *
 * Page 1 keeps formal form/table identity (header, personal, education).
 * Long English 職歴 / 自己PR use compact block flow, not giant bordered rows.
 * Replaces the previous compact-table renderer entirely (not a patch).
 */
import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { type Locale } from './i18n/translations';
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
import { type CVData } from './types';
import {
  buildCvExportRenderProjection,
  collectCvStructuredTextTokens,
  normalizeNarrativeWithProtectedStructuredTokens,
} from './cv-export-structured-text';

const A4_W = 210;
const A4_H = 297;

type Pdf = InstanceType<typeof import('jspdf').jsPDF>;

export type RirekishoDirectPdfContext = {
  pdf: Pdf;
  cv: CVData;
  locale: Locale;
  i18n: PdfI18nRegistry;
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
  lineH: number;
};

type BulletUnit = {
  lines: string[];
};

const C_TEXT: [number, number, number] = [17, 24, 39];
const C_MUTED: [number, number, number] = [75, 85, 99];
const C_BORDER: [number, number, number] = [209, 213, 219];
const C_HDR: [number, number, number] = [243, 244, 246];
const C_BAR: [number, number, number] = [31, 41, 55];
const C_SKILL: [number, number, number] = [249, 250, 251];
const C_LABEL: [number, number, number] = [55, 65, 81];

const BAR_H = 6.2;
const GAP_AFTER_BAR = 2.2;
const PAD_V = 1.2;
const PAD_H = 1.6;
const LINE = 3.2;
const BULLET_LH = 3.15;
const HDR_H = 5.6;
const PHOTO_W = 24;
const PHOTO_H = 32;
const PHOTO_GAP = 4;
const PERIOD_RATIO = 0.22;
const SELF_PR_SPARSE_MIN_LINES = 6;

const L = {
  title: '履\u3000歴\u3000書',
  sub: '(Curriculum Vitae)',
  name: '氏名 / Full Name',
  dob: '生年月日',
  gender: '性別',
  addr: '住所',
  phone: '電話番号',
  email: 'メール',
  edu: '学\u3000歴',
  exp: '職\u3000歴',
  period: '期間',
  eduCol: '学校名・学部・学科',
  expCol: '会社名・職位・職務内容',
  skills: 'スキル',
  langs: '語学',
  selfPr: '自己PR',
  present: '現在',
  expCont: '職歴 続き',
  selfCont: '自己PR 続き',
  photoPh: '写真\n3×4cm',
} as const;

/**
 * PDF-only text cleanup. Does not mutate saved CV data.
 * Fixes glued sentence boundaries while preserving Node.js / REST / CI/CD.
 */
export function rkNormalizePdfText(text: string, locale: Locale = 'en'): string {
  if (!text) return '';
  let out = text.replace(/\r\n/g, '\n');
  if (!shouldApplyLatinPdfSentenceFixes(locale, text)) {
    return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }

  // Protect common technical tokens from the sentence splitter.
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

  // Lowercase letter + "." + Capital → sentence boundary (logic.Built, applied.Designed, …)
  out = out.replace(/([a-z])\.([A-Z])/g, '$1. $2');
  out = out.replace(/([a-z])\.([A-Z])/g, '$1. $2');

  // Word.word.Capital glued stems (scaffolds.logic.Built, risk.lead.Assisted)
  out = out.replace(/\.([a-z]{3,})\.(\s*)([A-Z])/g, '. $1. $3');
  out = out.replace(/([a-z])\.([A-Z])/g, '$1. $2');

  // Common glued stems before a capital (risk.lead.Assisted → risk. lead. Assisted)
  out = out.replace(
    /\.([ \t]*)(lead|logic|applied|environments|built|designed|assisted)(?=\.?[A-Z])/gi,
    '. $2',
  );
  out = out.replace(/([a-z])\.([A-Z])/g, '$1. $2');
  out = out.replace(/\.([a-z]{3,})\.(\s*)([A-Z])/g, '. $1. $3');

  for (const p of protect) out = out.split(p.stub).join(p.token);

  return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

function applyStyle(ctx: RirekishoDirectPdfContext, s: Style, text?: string): void {
  pdfI18nCtxApplyStyle(ctx, { size: s.size, color: s.color, bold: s.bold }, text);
}

function drawText(
  ctx: RirekishoDirectPdfContext,
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

function wrap(
  ctx: RirekishoDirectPdfContext,
  text: string,
  maxW: number,
  style?: Pick<Style, 'size' | 'bold'>,
): string[] {
  const t = normalizeNarrativeWithProtectedStructuredTokens(
    text,
    collectCvStructuredTextTokens(ctx.cv),
    (protectedText) => rkNormalizePdfText(protectedText, ctx.locale),
  );
  if (!t) return [];
  const wrapStyle = style ?? { size: 8.6, bold: false };
  return pdfI18nCtxSplit(ctx, t, maxW, { size: wrapStyle.size, bold: wrapStyle.bold });
}

export function rkMeasureWrappedLines(ctx: RirekishoDirectPdfContext, text: string, maxW: number): string[] {
  return wrap(ctx, text, maxW);
}

function dateRange(start?: string, end?: string, present?: boolean): string {
  if (!start && !end && !present) return '';
  return `${start ?? ''}${start ? '〜' : ''}${present ? L.present : end ?? ''}`;
}

export function rkSplitIntoCleanBullets(
  raw: string,
  locale: Locale = 'ja',
  protectedTokens: readonly string[] = [],
): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => normalizeNarrativeWithProtectedStructuredTokens(
      l.replace(/^(?:[-*]|\u2022|\u30fb|\d+\.)\s*/, ''),
      protectedTokens,
      (protectedText) => rkNormalizePdfText(protectedText, locale),
    ))
    .filter(Boolean);
}

function freshCap(ctx: RirekishoDirectPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

export function rkCreateContext(
  pdf: Pdf,
  cv: CVData,
  locale: Locale,
  i18n: PdfI18nRegistry,
): RirekishoDirectPdfContext {
  const ml = 12;
  const mr = 12;
  const mt = 10;
  const mb = 11;
  return {
    pdf,
    cv,
    locale,
    i18n,
    contentX: ml,
    contentW: A4_W - ml - mr,
    marginTop: mt,
    marginBottom: mb,
    bottomSafeY: A4_H - mb,
    y: mt,
    pageIndex: 0,
  };
}

export function rkAddPage(ctx: RirekishoDirectPdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
}

export function rkEnsureSpace(ctx: RirekishoDirectPdfContext, h: number): void {
  if (ctx.y + h <= ctx.bottomSafeY) return;
  rkAddPage(ctx);
}

export function rkMoveToFreshPageIfNeeded(ctx: RirekishoDirectPdfContext, h: number): void {
  if (h > freshCap(ctx)) return;
  if (ctx.y + h > ctx.bottomSafeY) rkAddPage(ctx);
}

function border(ctx: RirekishoDirectPdfContext, x: number, y: number, w: number, h: number): void {
  ctx.pdf.setDrawColor(C_BORDER[0], C_BORDER[1], C_BORDER[2]);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.rect(x, y, w, h, 'S');
}

function fill(
  ctx: RirekishoDirectPdfContext,
  x: number,
  y: number,
  w: number,
  h: number,
  c: [number, number, number],
): void {
  ctx.pdf.setFillColor(c[0], c[1], c[2]);
  ctx.pdf.rect(x, y, w, h, 'F');
}

function drawTextLines(
  ctx: RirekishoDirectPdfContext,
  lines: string[],
  x: number,
  startY: number,
  s: Style,
): number {
  let cy = startY;
  for (const line of lines) {
    applyStyle(ctx, s, line);
    drawText(ctx, line, x, cy + s.size * 0.32, s);
    cy += s.lineH;
  }
  return cy;
}

export function rkMeasureBlockHeight(lineCount: number, lineH: number, pad = 0): number {
  if (lineCount <= 0) return pad;
  return lineCount * lineH + pad;
}

export function rkDrawTitle(ctx: RirekishoDirectPdfContext): void {
  const titleStyle: Style = { size: 17, color: C_TEXT, bold: true, lineH: 6.5 };
  const titleX = ctx.contentX + ctx.contentW / 2;
  applyStyle(ctx, titleStyle, L.title);
  drawText(ctx, L.title, titleX, ctx.y + 4.5, titleStyle, { align: 'center' });
  ctx.y += 7;
  const subStyle: Style = { size: 7.5, color: C_MUTED, lineH: 3 };
  applyStyle(ctx, subStyle, L.sub);
  drawText(ctx, L.sub, titleX, ctx.y, subStyle, { align: 'center' });
  ctx.y += 3.8;
  ctx.pdf.setDrawColor(C_TEXT[0], C_TEXT[1], C_TEXT[2]);
  ctx.pdf.setLineWidth(0.45);
  ctx.pdf.line(ctx.contentX, ctx.y, ctx.contentX + ctx.contentW, ctx.y);
  ctx.y += 2.8;
}

export function rkDrawPhoto(ctx: RirekishoDirectPdfContext, url: string | null, topY: number): void {
  const x = ctx.contentX + ctx.contentW - PHOTO_W;
  border(ctx, x, topY, PHOTO_W, PHOTO_H);
  if (url) {
    try {
      ctx.pdf.addImage(url, 'JPEG', x, topY, PHOTO_W, PHOTO_H, undefined, 'FAST');
      return;
    } catch {
      /* placeholder */
    }
  }
  fill(ctx, x, topY, PHOTO_W, PHOTO_H, C_SKILL);
  const phStyle: Style = { size: 7, color: [156, 163, 175], lineH: 3 };
  const ph = L.photoPh.split('\n');
  let py = topY + PHOTO_H / 2 - (ph.length * 3) / 2 + 1.5;
  const centerX = x + PHOTO_W / 2;
  for (const ln of ph) {
    applyStyle(ctx, phStyle, ln);
    drawText(ctx, ln, centerX, py, phStyle, { align: 'center' });
    py += 3;
  }
}

function personalRow(
  ctx: RirekishoDirectPdfContext,
  tx: number,
  ty: number,
  cols: number[],
  cells: Array<{ t: string; label?: boolean; sz?: number; bold?: boolean }>,
): number {
  const body: Style = { size: 8.6, color: C_TEXT, lineH: LINE };
  const lab: Style = { size: 8.6, color: C_LABEL, bold: true, lineH: LINE };
  let maxH = 0;
  const layouts: Array<{ x: number; w: number; lines: string[]; s: Style }> = [];
  let cx = tx;
  for (let i = 0; i < cells.length; i += 1) {
    const c = cells[i]!;
    const w = cols[i]!;
    const s: Style = c.label
      ? lab
      : { size: c.sz ?? 8.6, color: C_TEXT, bold: c.bold, lineH: LINE };
    const lines = wrap(ctx, c.t, w - PAD_H * 2, s);
    const h = Math.max(PAD_V * 2 + s.lineH, PAD_V * 2 + lines.length * s.lineH);
    maxH = Math.max(maxH, h);
    layouts.push({ x: cx, w, lines, s });
    cx += w;
  }
  for (let i = 0; i < layouts.length; i += 1) {
    const l = layouts[i]!;
    if (cells[i]?.label) fill(ctx, l.x, ty, l.w, maxH, C_HDR);
    border(ctx, l.x, ty, l.w, maxH);
    let cy = ty + PAD_V + l.s.size * 0.32;
    for (const line of l.lines) {
      applyStyle(ctx, l.s, line);
      drawText(ctx, line, l.x + PAD_H, cy, l.s);
      cy += l.s.lineH;
    }
  }
  return maxH;
}

export function rkDrawPersonalInfoTable(
  ctx: RirekishoDirectPdfContext,
  photoUrl: string | null,
): void {
  const tw = ctx.contentW - PHOTO_W - PHOTO_GAP;
  const tx = ctx.contentX;
  const y0 = ctx.y;
  const lw = tw * 0.22;
  const vw = tw - lw;
  const sl = tw * 0.16;

  rkDrawPhoto(ctx, photoUrl, y0);
  let ry = y0;
  let th = 0;
  const rows: Array<{ cols: number[]; cells: Array<{ t: string; label?: boolean; sz?: number; bold?: boolean }> }> = [
    {
      cols: [lw, vw],
      cells: [
        { t: L.name, label: true },
        { t: ctx.cv.personal.fullName || '', sz: 10.2, bold: true },
      ],
    },
    {
      cols: [lw, tw * 0.38, sl, tw - lw - tw * 0.38 - sl],
      cells: [
        { t: L.dob, label: true },
        { t: ctx.cv.personal.dateOfBirth || '' },
        { t: L.gender, label: true },
        { t: ctx.cv.personal.gender || '' },
      ],
    },
    {
      cols: [lw, vw],
      cells: [
        { t: L.addr, label: true },
        { t: ctx.cv.personal.address || '', sz: 8.2 },
      ],
    },
    {
      // Give メール more value width than 電話番号; メール label is short.
      cols: [lw, tw * 0.28, tw * 0.12, tw - lw - tw * 0.28 - tw * 0.12],
      cells: [
        { t: L.phone, label: true },
        { t: ctx.cv.personal.phone || '', sz: 8.2 },
        { t: L.email, label: true },
        {
          t: ctx.cv.personal.email || '',
          sz: resolveEmailCellFontSize(
            ctx,
            ctx.cv.personal.email || '',
            tw - lw - tw * 0.28 - tw * 0.12 - PAD_H * 2,
          ),
        },
      ],
    },
  ];
  for (const r of rows) {
    const h = personalRow(ctx, tx, ry, r.cols, r.cells);
    ry += h;
    th += h;
  }
  ctx.y = y0 + Math.max(th, PHOTO_H) + 2.5;
}

/** Shrink email font only when needed so long addresses stay on one line. */
function resolveEmailCellFontSize(
  ctx: RirekishoDirectPdfContext,
  email: string,
  maxW: number,
): number {
  if (!email) return 7.8;
  const preferred = 7.8;
  const min = 6.4;
  for (let sz = preferred; sz >= min - 0.01; sz -= 0.35) {
    const probeStyle: Style = { size: sz, color: C_TEXT, lineH: LINE };
    const lines = wrap(ctx, email, maxW, probeStyle);
    if (lines.length <= 1) return Math.round(sz * 100) / 100;
  }
  return min;
}

export function rkDrawSectionBar(ctx: RirekishoDirectPdfContext, label: string): void {
  rkEnsureSpace(ctx, BAR_H + GAP_AFTER_BAR);
  const y = ctx.y;
  fill(ctx, ctx.contentX, y, ctx.contentW, BAR_H, C_BAR);
  const barStyle: Style = { size: 9.5, color: [255, 255, 255], bold: true, lineH: BAR_H };
  applyStyle(ctx, barStyle, label);
  drawText(ctx, label, ctx.contentX + 2.2, y + BAR_H / 2 + 1.05, barStyle);
  ctx.y = y + BAR_H + GAP_AFTER_BAR;
}

function drawCompactTableHeader(ctx: RirekishoDirectPdfContext, a: string, b: string): {
  pw: number;
  dw: number;
} {
  const pw = ctx.contentW * PERIOD_RATIO;
  const dw = ctx.contentW - pw;
  const y = ctx.y;
  fill(ctx, ctx.contentX, y, pw, HDR_H, C_HDR);
  fill(ctx, ctx.contentX + pw, y, dw, HDR_H, C_HDR);
  border(ctx, ctx.contentX, y, pw, HDR_H);
  border(ctx, ctx.contentX + pw, y, dw, HDR_H);
  const hdrStyle: Style = { size: 8, color: C_LABEL, bold: true, lineH: 3 };
  applyStyle(ctx, hdrStyle, a);
  drawText(ctx, a, ctx.contentX + PAD_H, y + HDR_H / 2 + 0.85, hdrStyle);
  applyStyle(ctx, hdrStyle, b);
  drawText(ctx, b, ctx.contentX + pw + PAD_H, y + HDR_H / 2 + 0.85, hdrStyle);
  ctx.y += HDR_H;
  return { pw, dw };
}

function rkDrawCompactEducationSection(ctx: RirekishoDirectPdfContext): void {
  if (!ctx.cv.education.length) return;
  const pw = ctx.contentW * PERIOD_RATIO;
  const dw = ctx.contentW - pw;
  const ds: Style = { size: 8.5, color: C_TEXT, lineH: LINE };
  const ps: Style = { size: 8, color: C_MUTED, lineH: LINE };
  const first = ctx.cv.education[0]!;
  const firstDetail = rkNormalizePdfText([first.school, first.degree].filter(Boolean).join('\u3000'), ctx.locale);
  const firstLines = wrap(ctx, firstDetail, dw - PAD_H * 2, ds);
  const firstH = Math.max(
    PAD_V * 2 + firstLines.length * ds.lineH,
    PAD_V * 2 + ps.lineH,
  );
  rkMoveToFreshPageIfNeeded(ctx, BAR_H + GAP_AFTER_BAR + HDR_H + firstH);
  rkDrawSectionBar(ctx, L.edu);
  drawCompactTableHeader(ctx, L.period, L.eduCol);

  for (const edu of ctx.cv.education) {
    let detail = rkNormalizePdfText([edu.school, edu.degree].filter(Boolean).join('\u3000'), ctx.locale);
    if (edu.description) detail = `${detail}\n${rkNormalizePdfText(edu.description, ctx.locale)}`;
    const dLines = detail.split('\n').flatMap((p) => wrap(ctx, p, dw - PAD_H * 2, ds));
    const pLines = wrap(ctx, dateRange(edu.startDate, edu.endDate), pw - PAD_H * 2, ps);
    const rh = Math.max(
      PAD_V * 2 + dLines.length * ds.lineH,
      PAD_V * 2 + pLines.length * ps.lineH,
    );
    rkMoveToFreshPageIfNeeded(ctx, rh);
    const y = ctx.y;
    border(ctx, ctx.contentX, y, pw, rh);
    border(ctx, ctx.contentX + pw, y, dw, rh);
    let cy = y + PAD_V + ps.size * 0.32;
    for (const ln of pLines) {
      applyStyle(ctx, ps, ln);
      drawText(ctx, ln, ctx.contentX + PAD_H, cy, ps);
      cy += ps.lineH;
    }
    cy = y + PAD_V + ds.size * 0.32;
    for (const ln of dLines) {
      applyStyle(ctx, ds, ln);
      drawText(ctx, ln, ctx.contentX + pw + PAD_H, cy, ds);
      cy += ds.lineH;
    }
    ctx.y = y + rh;
  }
  ctx.y += 2;
}

function buildBulletUnits(ctx: RirekishoDirectPdfContext, raw: string, maxW: number): BulletUnit[] {
  return rkSplitIntoCleanBullets(
    raw,
    ctx.locale,
    collectCvStructuredTextTokens(ctx.cv),
  ).map((b) => ({
    lines: wrap(ctx, `\u30fb${b}`, maxW),
  }));
}

function bulletHeight(unit: BulletUnit): number {
  return unit.lines.length * BULLET_LH;
}

function measureLeadHeight(ctx: RirekishoDirectPdfContext, entry: CVData['experience'][number], dw: number): number {
  const cs: Style = { size: 8.6, color: C_TEXT, bold: true, lineH: LINE };
  const rs: Style = { size: 8.3, color: C_LABEL, lineH: LINE };
  let lines = 0;
  if (entry.company) lines += wrap(ctx, entry.company, dw - PAD_H * 2).length;
  if (entry.position) lines += wrap(ctx, entry.position, dw - PAD_H * 2).length;
  return Math.max(PAD_V * 2 + LINE, PAD_V * 2 + lines * Math.max(cs.lineH, rs.lineH));
}

function rkDrawWorkContinuationHeader(
  ctx: RirekishoDirectPdfContext,
  entry: CVData['experience'][number],
): void {
  rkEnsureSpace(ctx, 7);
  const contStyle: Style = { size: 8, color: C_MUTED, bold: true, lineH: 3.1 };
  applyStyle(ctx, contStyle, L.expCont);
  drawText(ctx, L.expCont, ctx.contentX, ctx.y + 2, contStyle);
  ctx.y += 3.6;
  const role = entry.position || entry.company || '';
  if (role) {
    const roleStyle: Style = { size: 8.2, color: C_TEXT, bold: true, lineH: 3.1 };
    const label = `${rkNormalizePdfText(role, ctx.locale)} (continued)`;
    for (const ln of wrap(ctx, label, ctx.contentW, roleStyle)) {
      applyStyle(ctx, roleStyle, ln);
      drawText(ctx, ln, ctx.contentX, ctx.y + 2, roleStyle);
      ctx.y += 3.2;
    }
  }
  ctx.y += 1;
}

function rkDrawWorkLeadBlock(
  ctx: RirekishoDirectPdfContext,
  entry: CVData['experience'][number],
  pw: number,
  dw: number,
): void {
  const ps: Style = { size: 8, color: C_MUTED, lineH: LINE };
  const cs: Style = { size: 8.6, color: C_TEXT, bold: true, lineH: LINE };
  const rs: Style = { size: 8.3, color: C_LABEL, lineH: LINE };
  const periodLines = wrap(ctx, dateRange(entry.startDate, entry.endDate, entry.isPresent), pw - PAD_H * 2, ps);
  const companyLines = entry.company ? wrap(ctx, entry.company, dw - PAD_H * 2, cs) : [];
  const roleLines = entry.position ? wrap(ctx, entry.position, dw - PAD_H * 2, rs) : [];
  const detailH = PAD_V * 2 + (companyLines.length + roleLines.length) * LINE;
  const periodH = PAD_V * 2 + Math.max(1, periodLines.length) * LINE;
  const rh = Math.max(detailH, periodH);

  rkMoveToFreshPageIfNeeded(ctx, rh);
  const y = ctx.y;
  border(ctx, ctx.contentX, y, pw, rh);
  border(ctx, ctx.contentX + pw, y, dw, rh);

  let cy = y + PAD_V + ps.size * 0.32;
  for (const ln of periodLines) {
    applyStyle(ctx, ps, ln);
    drawText(ctx, ln, ctx.contentX + PAD_H, cy, ps);
    cy += ps.lineH;
  }

  cy = y + PAD_V + cs.size * 0.32;
  for (const ln of companyLines) {
    applyStyle(ctx, cs, ln);
    drawText(ctx, ln, ctx.contentX + pw + PAD_H, cy, cs);
    cy += cs.lineH;
  }
  for (const ln of roleLines) {
    applyStyle(ctx, rs, ln);
    drawText(ctx, ln, ctx.contentX + pw + PAD_H, cy, rs);
    cy += rs.lineH;
  }

  ctx.y = y + rh + 0.8;
}

/**
 * Draw wrapped bullet lines as compact flow text — no giant bordered containers.
 * Splits a long bullet across pages only at wrapped-line boundaries.
 */
function rkDrawAtomicWrappedBullet(
  ctx: RirekishoDirectPdfContext,
  unit: BulletUnit,
  entry: CVData['experience'][number],
  x: number,
  maxW: number,
  continuation: { shown: boolean },
): void {
  const style: Style = { size: 8.2, color: C_MUTED, lineH: BULLET_LH };
  let lineIdx = 0;

  while (lineIdx < unit.lines.length) {
    const remainingSpace = ctx.bottomSafeY - ctx.y;
    const linesFit = Math.max(0, Math.floor(remainingSpace / BULLET_LH));

    if (linesFit <= 0) {
      rkAddPage(ctx);
      if (!continuation.shown) {
        rkDrawWorkContinuationHeader(ctx, entry);
        continuation.shown = true;
      }
      continue;
    }

    // Prefer keeping the entire remaining bullet together when it fits.
    const remaining = unit.lines.length - lineIdx;
    if (remaining > linesFit && lineIdx === 0 && remaining <= freshCap(ctx) / BULLET_LH) {
      // Whole bullet fits on a fresh page better — move now.
      rkAddPage(ctx);
      if (!continuation.shown) {
        rkDrawWorkContinuationHeader(ctx, entry);
        continuation.shown = true;
      }
      continue;
    }

    const take = Math.min(remaining, linesFit);
    const chunk = unit.lines.slice(lineIdx, lineIdx + take);
    for (const ln of chunk) {
      applyStyle(ctx, style, ln);
      drawText(ctx, ln, x, ctx.y + style.size * 0.32, style);
      ctx.y += style.lineH;
    }
    lineIdx += take;

    if (lineIdx < unit.lines.length) {
      rkAddPage(ctx);
      if (!continuation.shown) {
        rkDrawWorkContinuationHeader(ctx, entry);
        continuation.shown = true;
      }
    }
  }
  ctx.y += 0.35;
}

function rkDrawWorkBulletFlow(
  ctx: RirekishoDirectPdfContext,
  entry: CVData['experience'][number],
  bullets: BulletUnit[],
  startX: number,
  maxW: number,
  continuation: { shown: boolean },
): void {
  for (const unit of bullets) {
    rkDrawAtomicWrappedBullet(ctx, unit, entry, startX, maxW, continuation);
  }
}

function rkDrawWorkHistorySection(ctx: RirekishoDirectPdfContext): void {
  if (!ctx.cv.experience.length) return;
  const pw = ctx.contentW * PERIOD_RATIO;
  const dw = ctx.contentW - pw;
  const first = ctx.cv.experience[0]!;
  const firstBullets = buildBulletUnits(ctx, first.description || '', dw - PAD_H * 2);
  const leadH = measureLeadHeight(ctx, first, dw);
  const firstBulletH = firstBullets[0] ? bulletHeight(firstBullets[0]) : 0;
  // Keep heading + lead + at least first bullet together when possible.
  rkMoveToFreshPageIfNeeded(
    ctx,
    BAR_H + GAP_AFTER_BAR + HDR_H + leadH + Math.min(firstBulletH, BULLET_LH * 2),
  );
  rkDrawSectionBar(ctx, L.exp);
  drawCompactTableHeader(ctx, L.period, L.expCol);

  for (const entry of ctx.cv.experience) {
    const detailBullets = buildBulletUnits(ctx, entry.description || '', dw - PAD_H * 2);
    const fullWidthBullets = buildBulletUnits(ctx, entry.description || '', ctx.contentW);
    const continuation = { shown: false };

    const leadHEntry = measureLeadHeight(ctx, entry, dw);
    const firstBh = detailBullets[0] ? bulletHeight(detailBullets[0]) : 0;
    // If lead + first bullet won't fit, move together — never leave orphan lead with empty page below when possible.
    if (
      ctx.y + leadHEntry + Math.min(firstBh, BULLET_LH) > ctx.bottomSafeY
      && leadHEntry + Math.min(firstBh, BULLET_LH) <= freshCap(ctx)
    ) {
      rkAddPage(ctx);
    }

    rkDrawWorkLeadBlock(ctx, entry, pw, dw);

    // Fill remaining page  with as many detail-column bullets as fit (avoid page-1 underfill).
    let bi = 0;
    while (bi < detailBullets.length) {
      const unit = detailBullets[bi]!;
      const h = bulletHeight(unit);
      if (ctx.y + Math.min(h, BULLET_LH) > ctx.bottomSafeY) break;
      rkDrawAtomicWrappedBullet(ctx, unit, entry, ctx.contentX + pw + PAD_H, dw - PAD_H * 2, continuation);
      bi += 1;
    }

    // Remaining bullets continue full-width on next pages — no empty 期間 column.
    if (bi < fullWidthBullets.length) {
      if (ctx.y + BULLET_LH > ctx.bottomSafeY || bi > 0) {
        // If we already drew some bullets, remaining need a new page only when no room.
        if (ctx.y + bulletHeight(fullWidthBullets[bi]!) > ctx.bottomSafeY) {
          rkAddPage(ctx);
          if (!continuation.shown) {
            rkDrawWorkContinuationHeader(ctx, entry);
            continuation.shown = true;
          }
        } else if (bi === 0 && ctx.y + bulletHeight(fullWidthBullets[0]!) > ctx.bottomSafeY) {
          rkAddPage(ctx);
          if (!continuation.shown) {
            rkDrawWorkContinuationHeader(ctx, entry);
            continuation.shown = true;
          }
        }
      }
      for (let j = bi; j < fullWidthBullets.length; j += 1) {
        rkDrawAtomicWrappedBullet(
          ctx,
          fullWidthBullets[j]!,
          entry,
          ctx.contentX,
          ctx.contentW,
          continuation,
        );
      }
    }
    ctx.y += 1.5;
  }
  ctx.y += 1;
}

function measureSkillsLangsHeight(ctx: RirekishoDirectPdfContext): number {
  const rowH = PAD_V * 2 + LINE;
  const skills = ctx.cv.skills.length
    ? BAR_H + GAP_AFTER_BAR + Math.ceil(ctx.cv.skills.length / 3) * rowH
    : 0;
  const langs = ctx.cv.languages.length
    ? BAR_H + GAP_AFTER_BAR + ctx.cv.languages.length * rowH
    : 0;
  return skills + (skills && langs ? 1.2 : 0) + langs;
}

function rkDrawSkillsLanguagesGroup(ctx: RirekishoDirectPdfContext): void {
  const total = measureSkillsLangsHeight(ctx);
  if (!total) return;
  rkMoveToFreshPageIfNeeded(ctx, total);

  if (ctx.cv.skills.length) {
    rkDrawSectionBar(ctx, L.skills);
    const colW = ctx.contentW / 3;
    const rowH = PAD_V * 2 + LINE;
    const ss: Style = { size: 8.5, color: C_TEXT, lineH: LINE };
    for (let i = 0; i < ctx.cv.skills.length; i += 3) {
      rkMoveToFreshPageIfNeeded(ctx, rowH);
      const y = ctx.y;
      for (let o = 0; o < 3; o += 1) {
        const raw = ctx.cv.skills[i + o] ?? '';
        const skill = raw ? getLocalizedCvSkillName(raw, ctx.locale) || raw : '';
        const x = ctx.contentX + colW * o;
        if (skill) fill(ctx, x, y, colW, rowH, C_SKILL);
        border(ctx, x, y, colW, rowH);
        if (skill) {
          applyStyle(ctx, ss, skill);
          drawText(ctx, skill, x + PAD_H, y + PAD_V + ss.size * 0.32, ss);
        }
      }
      ctx.y = y + rowH;
    }
    ctx.y += 1.2;
  }

  if (ctx.cv.languages.length) {
    const langsH =
      BAR_H + GAP_AFTER_BAR + ctx.cv.languages.length * (PAD_V * 2 + LINE);
    if (ctx.y + langsH > ctx.bottomSafeY) rkAddPage(ctx);
    rkDrawSectionBar(ctx, L.langs);
    const colW = ctx.contentW / 2;
    const rowH = PAD_V * 2 + LINE;
    const ns: Style = { size: 8.5, color: C_TEXT, bold: true, lineH: LINE };
    const ls: Style = { size: 8.5, color: C_MUTED, lineH: LINE };
    for (const lang of ctx.cv.languages) {
      rkMoveToFreshPageIfNeeded(ctx, rowH);
      const y = ctx.y;
      const name = getLocalizedCvLanguageName(lang.name, ctx.locale) || lang.name;
      border(ctx, ctx.contentX, y, colW, rowH);
      border(ctx, ctx.contentX + colW, y, colW, rowH);
      applyStyle(ctx, ns, name);
      drawText(ctx, name, ctx.contentX + PAD_H, y + PAD_V + ns.size * 0.32, ns);
      applyStyle(ctx, ls, lang.level || '');
      drawText(ctx, lang.level || '', ctx.contentX + colW + PAD_H, y + PAD_V + ls.size * 0.32, ls);
      ctx.y = y + rowH;
    }
  }
  ctx.y += 1.5;
}

/**
 * Rebalance Self PR page splits so the final page is not a tiny tail.
 */
export function rkRebalanceSparseFinalSelfPrPage(
  fragments: string[][],
  minLastLines = SELF_PR_SPARSE_MIN_LINES,
): string[][] {
  if (fragments.length < 2) return fragments;
  const last = fragments[fragments.length - 1]!;
  if (last.length >= minLastLines) return fragments;

  const out = fragments.map((f) => [...f]);
  let guard = 0;
  while (
    out.length >= 2
    && out[out.length - 1]!.length < minLastLines
    && out[out.length - 2]!.length > minLastLines
    && guard < 200
  ) {
    const prev = out[out.length - 2]!;
    const moved = prev.pop();
    if (!moved) break;
    out[out.length - 1]!.unshift(moved);
    guard += 1;
  }

  // If last is still tiny and previous is small enough, merge into previous.
  if (
    out.length >= 2
    && out[out.length - 1]!.length < minLastLines
    && out[out.length - 2]!.length + out[out.length - 1]!.length <= minLastLines * 3
  ) {
    const tail = out.pop()!;
    out[out.length - 1]!.push(...tail);
  }
  return out;
}

function planSelfPrFragments(
  ctx: RirekishoDirectPdfContext,
  lines: string[],
  firstPageY: number,
): string[][] {
  const fragments: string[][] = [];
  let idx = 0;
  let pageY = firstPageY;
  let isFirst = true;

  while (idx < lines.length) {
    const headerH = isFirst ? 0 : 5; // continuation header space estimate
    let room = ctx.bottomSafeY - pageY - headerH;
    if (room < BULLET_LH * 2) {
      pageY = ctx.marginTop;
      room = ctx.bottomSafeY - pageY - (isFirst ? 0 : 5);
      isFirst = false;
    }
    const maxLines = Math.max(1, Math.floor(room / (LINE + 0.1)));
    const keepMin = isFirst ? Math.min(3, lines.length - idx) : 1;
    const take = Math.max(keepMin, Math.min(maxLines, lines.length - idx));
    fragments.push(lines.slice(idx, idx + take));
    idx += take;
    pageY = ctx.marginTop;
    isFirst = false;
  }

  return rkRebalanceSparseFinalSelfPrPage(fragments);
}

function rkDrawSelfPrContinuation(ctx: RirekishoDirectPdfContext): void {
  rkEnsureSpace(ctx, 5);
  const contStyle: Style = { size: 8, color: C_MUTED, bold: true, lineH: 3.1 };
  applyStyle(ctx, contStyle, L.selfCont);
  drawText(ctx, L.selfCont, ctx.contentX, ctx.y + 2, contStyle);
  ctx.y += 4.5;
}

function rkDrawSelfPrSection(ctx: RirekishoDirectPdfContext): void {
  if (!ctx.cv.summary) return;
  const normalized = rkNormalizePdfText(ctx.cv.summary, ctx.locale);
  if (!normalized) return;

  const style: Style = { size: 8.6, color: C_TEXT, lineH: LINE + 0.1 };
  const paragraphs = normalized.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const lines = paragraphs.flatMap((p) => wrap(ctx, p, ctx.contentW, style));
  if (!lines.length) return;

  const keep = Math.min(3, lines.length);
  const keepH = BAR_H + GAP_AFTER_BAR + keep * style.lineH;
  rkMoveToFreshPageIfNeeded(ctx, keepH);

  rkDrawSectionBar(ctx, L.selfPr);

  // Plan fragments from the actual y after the section bar, then rebalance sparse tails.
  const fragments = planSelfPrFragments(ctx, lines, ctx.y);

  for (let fi = 0; fi < fragments.length; fi += 1) {
    const frag = fragments[fi]!;
    if (fi > 0) {
      rkAddPage(ctx);
      rkDrawSelfPrContinuation(ctx);
    }

    for (const line of frag) {
      // Never page-break mid-fragment without a continuation header.
      if (ctx.y + style.lineH > ctx.bottomSafeY) {
        rkAddPage(ctx);
        rkDrawSelfPrContinuation(ctx);
      }
      applyStyle(ctx, style, line);
      drawText(ctx, line, ctx.contentX, ctx.y + style.size * 0.32, style);
      ctx.y += style.lineH;
    }
  }
  ctx.y += 1.5;
}

function rkDrawCertifications(ctx: RirekishoDirectPdfContext): void {
  if (!ctx.cv.certifications.length) return;
  rkDrawSectionBar(ctx, '資格・免許');
  const style: Style = { size: 8.5, color: C_TEXT, lineH: LINE };
  for (const cert of ctx.cv.certifications) {
    // Keep the Japanese list marker separate from the localized run. A mixed
    // marker+Hindi/Arabic string makes jsPDF choose the marker's font while
    // splitting, which can collapse the certification text to just "・".
    const lines = wrap(ctx, cert, ctx.contentW - 5, style);
    for (const [index, ln] of lines.entries()) {
      rkEnsureSpace(ctx, style.lineH);
      if (index === 0) drawText(ctx, '\u30fb', ctx.contentX, ctx.y + style.size * 0.32, style);
      applyStyle(ctx, style, ln);
      drawText(ctx, ln, ctx.contentX + 4, ctx.y + style.size * 0.32, style);
      ctx.y += style.lineH;
    }
  }
  ctx.y += 1;
}

export async function buildRirekishoPagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const i18n = await registerPdfI18nFonts(pdf);
  const renderCv = buildCvExportRenderProjection(cv, locale);
  const ctx = rkCreateContext(pdf, renderCv, locale, i18n);

  rkDrawTitle(ctx);
  rkDrawPersonalInfoTable(ctx, options.photoDataUrl ?? null);
  rkDrawCompactEducationSection(ctx);
  rkDrawWorkHistorySection(ctx);
  rkDrawSkillsLanguagesGroup(ctx);
  rkDrawSelfPrSection(ctx);
  rkDrawCertifications(ctx);

  const out = pdf.output('blob');
  return out instanceof Blob ? out : new Blob([out], { type: 'application/pdf' });
}
