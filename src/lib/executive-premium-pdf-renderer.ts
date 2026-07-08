/**
 * Executive Premium — dedicated direct jsPDF page-aware renderer.
 *
 * Replaces the previous DOM capture / tall-canvas / slice export path.
 * Page 1 draws a full-width navy header, then immediately uses the body
 * for PROFESSIONAL SUMMARY (never leave page 1 blank after the header).
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

const NAVY: [number, number, number] = [17, 24, 39];
const GOLD: [number, number, number] = [217, 119, 6];
const SOFT_GOLD: [number, number, number] = [252, 211, 77];
const TEXT: [number, number, number] = [17, 24, 39];
const BODY: [number, number, number] = [55, 65, 81];
const MUTED: [number, number, number] = [107, 114, 128];
const HEADING: [number, number, number] = [156, 163, 175];
const RULE: [number, number, number] = [229, 231, 235];
const CHIP_BG: [number, number, number] = [249, 250, 251];
const CONTACT: [number, number, number] = [209, 213, 219];

const MARGIN_X = 16;
const MARGIN_TOP_CONT = 16;
const MARGIN_BOTTOM = 14;
const BODY_AFTER_HEADER = 12;
const LINE = 4.0;
const BODY_LINE = 3.7;
const BULLET_LH = 3.6;
const SECTION_H = 7.5;
const PHOTO_R = 14;
const SPARSE_LOWER_THRESHOLD_MM = 55;

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
  };
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

function setStyle(ctx: ExecutivePremiumDirectPdfContext, s: Style): void {
  const family = s.font ?? 'helvetica';
  let style: 'normal' | 'bold' | 'italic' | 'bolditalic' = 'normal';
  if (s.bold && s.italic) style = 'bolditalic';
  else if (s.bold) style = 'bold';
  else if (s.italic) style = 'italic';
  ctx.pdf.setFont(family, style);
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

export function epMeasureBlockHeight(lineCount: number, lineH: number, pad = 0): number {
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
): ExecutivePremiumDirectPdfContext {
  return {
    pdf,
    cv,
    locale,
    labels: getExecutivePremiumPdfLabels(locale),
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

export function epAddPage(ctx: ExecutivePremiumDirectPdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
}

export function epEnsureSpace(ctx: ExecutivePremiumDirectPdfContext, h: number): void {
  if (ctx.y + h <= ctx.bottomSafeY) return;
  epAddPage(ctx);
}

export function epMoveToFreshPageIfNeeded(ctx: ExecutivePremiumDirectPdfContext, h: number): void {
  if (h > freshCap(ctx)) return;
  if (ctx.y + h > ctx.bottomSafeY) epAddPage(ctx);
}

function splitBullets(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => epNormalizePdfText(l.replace(/^(?:[-*]|\u2022|\d+\.)\s*/, '')))
    .filter(Boolean);
}

function buildBullets(ctx: ExecutivePremiumDirectPdfContext, raw: string, maxW: number): BulletUnit[] {
  return splitBullets(raw).map((b) => ({
    lines: epMeasureWrappedLines(ctx, `- ${b}`, maxW),
  }));
}

function bulletH(unit: BulletUnit): number {
  return unit.lines.length * BULLET_LH;
}

export function epDrawHeader(
  ctx: ExecutivePremiumDirectPdfContext,
  photoDataUrl: string | null,
): void {
  const headerH = photoDataUrl ? 52 : 42;
  ctx.pdf.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  ctx.pdf.rect(0, 0, A4_W, headerH, 'F');

  const textLeft = MARGIN_X;
  const textMaxW = photoDataUrl
    ? A4_W - MARGIN_X * 2 - PHOTO_R * 2 - 10
    : ctx.contentW;
  let ty = 10;

  const name = (ctx.cv.personal.fullName || 'YOUR NAME').toUpperCase();
  setStyle(ctx, {
    size: 18,
    color: [255, 255, 255],
    font: 'times',
    lineH: 6.5,
  });
  const nameLines = epMeasureWrappedLines(ctx, name, textMaxW).slice(0, 2);
  for (const ln of nameLines) {
    ctx.pdf.text(ln, textLeft, ty + 4.5);
    ty += 6.2;
  }

  // Gold accent under name
  ctx.pdf.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  ctx.pdf.rect(textLeft, ty + 1, 18, 0.55, 'F');
  ty += 5;

  if (ctx.cv.personal.jobTitle) {
    setStyle(ctx, {
      size: 10,
      color: SOFT_GOLD,
      font: 'times',
      lineH: 4,
    });
    const titleLines = epMeasureWrappedLines(ctx, ctx.cv.personal.jobTitle, textMaxW).slice(0, 2);
    for (const ln of titleLines) {
      ctx.pdf.text(ln, textLeft, ty + 3);
      ty += 4;
    }
  }

  const contacts = [
    ctx.cv.personal.email,
    ctx.cv.personal.phone,
    ctx.cv.personal.address,
  ].filter(Boolean) as string[];
  if (contacts.length) {
    ty += 2;
    setStyle(ctx, { size: 8, color: CONTACT, font: 'helvetica', lineH: 3.4 });
    const contactText = contacts.join('  |  ');
    for (const ln of epMeasureWrappedLines(ctx, contactText, textMaxW).slice(0, 2)) {
      // Draw with gold separators preserved in joined string
      ctx.pdf.text(ln, textLeft, ty + 2.5);
      ty += 3.5;
    }
  }

  if (photoDataUrl) {
    const cx = A4_W - MARGIN_X - PHOTO_R;
    const cy = headerH / 2;
    try {
      // Soft circular frame — clip via sequential path
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
      // Mask ring to soften square image corners toward circle appearance
      ctx.pdf.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
      ctx.pdf.setLineWidth(2.2);
      ctx.pdf.circle(cx, cy, PHOTO_R + 0.3, 'S');
      ctx.pdf.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
      ctx.pdf.setLineWidth(0.4);
      ctx.pdf.circle(cx, cy, PHOTO_R + 0.6, 'S');
    } catch {
      ctx.pdf.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
      ctx.pdf.setLineWidth(0.4);
      ctx.pdf.circle(cx, cy, PHOTO_R, 'S');
    }
  }

  // Thin accent rule under the full-width header
  ctx.pdf.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  ctx.pdf.rect(0, headerH, A4_W, 0.7, 'F');

  ctx.headerDrawn = true;
  // CRITICAL: body starts immediately under the header — never leave page 1 blank.
  ctx.y = headerH + BODY_AFTER_HEADER;
}

export function epDrawSectionHeading(
  ctx: ExecutivePremiumDirectPdfContext,
  label: string,
  opts: { centered?: boolean } = {},
): void {
  epEnsureSpace(ctx, SECTION_H + 2);
  setStyle(ctx, {
    size: 8.5,
    color: HEADING,
    bold: true,
    font: 'times',
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

export function epDrawWrappedText(
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
  const style: Style = {
    size: 9.5,
    color: BODY,
    italic: true,
    font: 'times',
    lineH: BODY_LINE,
  };
  const lines = epMeasureWrappedLines(ctx, ctx.cv.summary, ctx.contentW);
  if (!lines.length) return;

  const keep = Math.min(3, lines.length);
  epMoveToFreshPageIfNeeded(ctx, SECTION_H + keep * style.lineH);
  epDrawSectionHeading(ctx, ctx.labels.summary);

  for (const line of lines) {
    if (ctx.y + style.lineH > ctx.bottomSafeY) epAddPage(ctx);
    setStyle(ctx, style);
    ctx.pdf.text(line, ctx.contentX, ctx.y + style.size * 0.32);
    ctx.y += style.lineH;
  }
  ctx.y += 4;
}

function measureLeadH(ctx: ExecutivePremiumDirectPdfContext, entry: CVData['experience'][number]): number {
  const title = [entry.position, entry.company].filter(Boolean).join(', ');
  const titleLines = epMeasureWrappedLines(ctx, title, ctx.contentW - 42);
  return Math.max(4.2, titleLines.length * 4.2) + 3.2;
}

export function epDrawContinuationHeader(
  ctx: ExecutivePremiumDirectPdfContext,
  entry: CVData['experience'][number],
): void {
  epEnsureSpace(ctx, 5);
  const role = entry.position || entry.company || 'Experience';
  setStyle(ctx, { size: 8.2, color: MUTED, bold: true, font: 'helvetica', lineH: 3.4 });
  const label = `${epNormalizePdfText(role)} (continued)`;
  ctx.pdf.text(label, ctx.contentX, ctx.y + 2.5);
  ctx.y += 5;
}

function drawExperienceLead(
  ctx: ExecutivePremiumDirectPdfContext,
  entry: CVData['experience'][number],
): void {
  const title = [entry.position, entry.company].filter(Boolean).join(', ');
  const date = [entry.startDate, entry.isPresent ? ctx.labels.present : entry.endDate]
    .filter(Boolean)
    .join(' - ');

  setStyle(ctx, { size: 10.5, color: TEXT, bold: true, font: 'times', lineH: 4.2 });
  const titleLines = epMeasureWrappedLines(ctx, title, ctx.contentW - 42);
  const startY = ctx.y;
  let ty = startY;
  for (const ln of titleLines) {
    ctx.pdf.text(ln, ctx.contentX, ty + 3.2);
    ty += 4.2;
  }

  if (date) {
    setStyle(ctx, { size: 8.2, color: HEADING, italic: true, font: 'helvetica', lineH: 3.2 });
    const dw = ctx.pdf.getTextWidth(date);
    ctx.pdf.text(date, ctx.contentX + ctx.contentW - dw, startY + 3);
  }

  // Subtle gold underline under the role line (executive accent)
  ctx.pdf.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  ctx.pdf.setLineWidth(0.35);
  const accentW = Math.min(22, ctx.contentW * 0.12);
  ctx.pdf.line(ctx.contentX, ty + 0.4, ctx.contentX + accentW, ty + 0.4);

  ctx.y = ty + 2.2;
}

export function epDrawBulletAtomic(
  ctx: ExecutivePremiumDirectPdfContext,
  unit: BulletUnit,
  entry: CVData['experience'][number],
  continuation: { shown: boolean },
): void {
  const style: Style = { size: 9, color: BODY, font: 'helvetica', lineH: BULLET_LH };
  let idx = 0;
  while (idx < unit.lines.length) {
    const remaining = unit.lines.length - idx;
    const room = Math.floor((ctx.bottomSafeY - ctx.y) / BULLET_LH);
    if (room <= 0) {
      epAddPage(ctx);
      if (!continuation.shown) {
        epDrawContinuationHeader(ctx, entry);
        continuation.shown = true;
      }
      continue;
    }
    if (remaining > room && idx === 0 && remaining * BULLET_LH <= freshCap(ctx)) {
      epAddPage(ctx);
      if (!continuation.shown) {
        epDrawContinuationHeader(ctx, entry);
        continuation.shown = true;
      }
      continue;
    }
    const take = Math.min(remaining, Math.max(1, room));
    const chunk = unit.lines.slice(idx, idx + take);
    epDrawWrappedText(ctx, chunk, style);
    idx += take;
    if (idx < unit.lines.length) {
      epAddPage(ctx);
      if (!continuation.shown) {
        epDrawContinuationHeader(ctx, entry);
        continuation.shown = true;
      }
    }
  }
  ctx.y += 0.4;
}

export function epDrawExperienceEntryPaginated(
  ctx: ExecutivePremiumDirectPdfContext,
  entry: CVData['experience'][number],
): void {
  const bullets = buildBullets(ctx, entry.description || '', ctx.contentW - 4);
  const leadH = measureLeadH(ctx, entry);
  const firstBh = bullets[0] ? bulletH(bullets[0]) : 0;
  const keepH = leadH + Math.min(firstBh, BULLET_LH * 2);

  if (ctx.y + keepH > ctx.bottomSafeY && keepH <= freshCap(ctx)) epAddPage(ctx);

  drawExperienceLead(ctx, entry);
  const continuation = { shown: false };
  for (const unit of bullets) {
    epDrawBulletAtomic(ctx, unit, entry, continuation);
  }
  ctx.y += 3.5;
}

export function epDrawExperienceSection(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.experience.length) return;
  const first = ctx.cv.experience[0]!;
  const leadH = measureLeadH(ctx, first);
  const bullets = buildBullets(ctx, first.description || '', ctx.contentW - 4);
  const firstBh = bullets[0] ? bulletH(bullets[0]) : 0;
  epMoveToFreshPageIfNeeded(ctx, SECTION_H + leadH + Math.min(firstBh, BULLET_LH * 2));
  epDrawSectionHeading(ctx, ctx.labels.experience);
  for (const entry of ctx.cv.experience) {
    epDrawExperienceEntryPaginated(ctx, entry);
  }
}

export function epDrawEducationSection(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.education.length) return;
  const first = ctx.cv.education[0]!;
  const firstH = 10;
  epMoveToFreshPageIfNeeded(ctx, SECTION_H + firstH);
  epDrawSectionHeading(ctx, ctx.labels.education, { centered: true });

  for (const edu of ctx.cv.education) {
    epMoveToFreshPageIfNeeded(ctx, 10);
    setStyle(ctx, { size: 10, color: TEXT, bold: true, font: 'times', lineH: 4 });
    const degree = epNormalizePdfText(edu.degree || '');
    const dw = ctx.pdf.getTextWidth(degree);
    ctx.pdf.text(degree, ctx.contentX + (ctx.contentW - dw) / 2, ctx.y + 3);
    ctx.y += 4.2;

    const meta = [
      edu.school,
      [edu.startDate, edu.endDate].filter(Boolean).join(' - '),
    ]
      .filter(Boolean)
      .join(' | ');
    if (meta) {
      setStyle(ctx, { size: 8.5, color: MUTED, font: 'helvetica', lineH: 3.4 });
      const mw = ctx.pdf.getTextWidth(meta);
      ctx.pdf.text(meta, ctx.contentX + (ctx.contentW - mw) / 2, ctx.y + 2.5);
      ctx.y += 4;
    }
    if (edu.description) {
      const lines = epMeasureWrappedLines(ctx, edu.description, ctx.contentW);
      epDrawWrappedText(ctx, lines, {
        size: 8.5,
        color: BODY,
        font: 'helvetica',
        lineH: 3.4,
      }, { centered: true });
    }
    ctx.y += 2;
  }
}

type Chip = { text: string; w: number };

export function epLayoutSkillChips(
  ctx: ExecutivePremiumDirectPdfContext,
  skills: string[],
): Chip[] {
  setStyle(ctx, { size: 8.2, color: BODY, font: 'helvetica', lineH: 3.2 });
  return skills.map((raw) => {
    const text = getLocalizedCvSkillName(raw, ctx.locale) || raw;
    const w = Math.min(ctx.contentW, ctx.pdf.getTextWidth(text) + 5);
    return { text, w };
  });
}

function measureSkillsBlockH(ctx: ExecutivePremiumDirectPdfContext): number {
  if (!ctx.cv.skills.length) return 0;
  const chips = epLayoutSkillChips(ctx, ctx.cv.skills);
  const rowH = 6.2;
  let x = 0;
  let rows = 1;
  for (const chip of chips) {
    if (x > 0 && x + chip.w > ctx.contentW) {
      rows += 1;
      x = 0;
    }
    x += chip.w + 2.2;
  }
  return SECTION_H + rows * rowH + 2;
}

function measureLangsBlockH(ctx: ExecutivePremiumDirectPdfContext): number {
  if (!ctx.cv.languages.length) return 0;
  return SECTION_H + ctx.cv.languages.length * 4.2 + 2;
}

function drawSkillChips(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.skills.length) return;
  epDrawSectionHeading(ctx, ctx.labels.skills);
  const chips = epLayoutSkillChips(ctx, ctx.cv.skills);
  const rowH = 6.2;
  let x = ctx.contentX;
  let rowY = ctx.y;

  const newRow = () => {
    rowY += rowH;
    x = ctx.contentX;
    if (rowY + rowH > ctx.bottomSafeY) {
      epAddPage(ctx);
      rowY = ctx.y;
      x = ctx.contentX;
    }
  };

  for (const chip of chips) {
    if (x > ctx.contentX && x + chip.w > ctx.contentX + ctx.contentW) newRow();
    ctx.pdf.setFillColor(CHIP_BG[0], CHIP_BG[1], CHIP_BG[2]);
    ctx.pdf.setDrawColor(RULE[0], RULE[1], RULE[2]);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.rect(x, rowY, chip.w, 5.2, 'FD');
    setStyle(ctx, { size: 8.2, color: BODY, font: 'helvetica', lineH: 3.2 });
    ctx.pdf.text(chip.text, x + 2.4, rowY + 3.5);
    x += chip.w + 2.2;
  }
  ctx.y = rowY + rowH + 1;
}

function drawLanguages(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.languages.length) return;
  epDrawSectionHeading(ctx, ctx.labels.languages);
  for (const lang of ctx.cv.languages) {
    epEnsureSpace(ctx, 4.2);
    const name = getLocalizedCvLanguageName(lang.name, ctx.locale) || lang.name;
    setStyle(ctx, { size: 9, color: TEXT, bold: true, font: 'helvetica', lineH: 3.6 });
    ctx.pdf.text(name, ctx.contentX, ctx.y + 2.8);
    if (lang.level) {
      setStyle(ctx, { size: 8.5, color: MUTED, font: 'helvetica', lineH: 3.6 });
      const lw = ctx.pdf.getTextWidth(lang.level);
      ctx.pdf.text(lang.level, ctx.contentX + ctx.contentW - lw, ctx.y + 2.8);
    }
    ctx.y += 4.2;
  }
  ctx.y += 1.5;
}

/**
 * Keep Skills + Languages together when the combined block fits;
 * avoid stranding them on a nearly empty final page when possible.
 */
export function epRebalanceLowerSections(ctx: ExecutivePremiumDirectPdfContext): void {
  const skillsH = measureSkillsBlockH(ctx);
  const langsH = measureLangsBlockH(ctx);
  const total = skillsH + langsH;
  if (!total) return;

  const remaining = ctx.bottomSafeY - ctx.y;
  if (total <= remaining) return;
  if (total <= freshCap(ctx)) {
    // Move the whole lower group to a fresh page if it won't look sparse
    // and the current leftover is smaller than the group.
    if (remaining < SPARSE_LOWER_THRESHOLD_MM) epAddPage(ctx);
  }
}

export function epDrawSkillsLanguagesGroup(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.skills.length && !ctx.cv.languages.length) return;
  epRebalanceLowerSections(ctx);

  const skillsH = measureSkillsBlockH(ctx);
  const langsH = measureLangsBlockH(ctx);
  const combined = skillsH + langsH;

  if (combined > 0 && combined <= ctx.bottomSafeY - ctx.y) {
    // Draw both in place
  } else if (combined <= freshCap(ctx) && ctx.y + Math.min(skillsH, langsH || skillsH) > ctx.bottomSafeY) {
    epAddPage(ctx);
  }

  if (ctx.cv.skills.length) {
    if (ctx.y + skillsH > ctx.bottomSafeY && skillsH <= freshCap(ctx)) epAddPage(ctx);
    drawSkillChips(ctx);
  }
  if (ctx.cv.languages.length) {
    if (ctx.y + langsH > ctx.bottomSafeY && langsH <= freshCap(ctx)) epAddPage(ctx);
    drawLanguages(ctx);
  }
}

function epDrawCertifications(ctx: ExecutivePremiumDirectPdfContext): void {
  if (!ctx.cv.certifications.length) return;
  epMoveToFreshPageIfNeeded(ctx, SECTION_H + 6);
  epDrawSectionHeading(ctx, ctx.labels.certifications, { centered: true });
  for (const cert of ctx.cv.certifications) {
    const lines = epMeasureWrappedLines(ctx, epNormalizePdfText(cert), ctx.contentW);
    epDrawWrappedText(
      ctx,
      lines,
      { size: 9, color: BODY, font: 'helvetica', lineH: 3.6 },
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
  const ctx = epCreateContext(pdf, cv, locale);

  epDrawHeader(ctx, options.photoDataUrl ?? null);
  epDrawSummary(ctx);
  epDrawExperienceSection(ctx);
  epDrawEducationSection(ctx);
  epDrawSkillsLanguagesGroup(ctx);
  epDrawCertifications(ctx);

  const out = pdf.output('blob');
  return out instanceof Blob ? out : new Blob([out], { type: 'application/pdf' });
}
