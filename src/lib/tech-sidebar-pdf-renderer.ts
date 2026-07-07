/**
 * Tech Sidebar dedicated direct jsPDF renderer (design-first, page-aware).
 * Imported by export.ts — kept in a separate module for clarity.
 */
import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { splitCleanSimpleSummarySentenceRuns } from './clean-simple-pdf-template';
import { translations, type Locale } from './i18n/translations';
import { regionSettings, type CVData } from './types';
const CV_PDF_A4_WIDTH_MM = 210;
const CV_PDF_A4_HEIGHT_MM = 297;

type TechSidebarPdfWriter = InstanceType<typeof import('jspdf').jsPDF>;

export type TechSidebarDirectPdfContext = {
  pdf: TechSidebarPdfWriter;
  cv: CVData;
  locale: Locale;
  labels: ReturnType<typeof getTechSidebarPdfLabels>;
  pageWidth: number;
  pageHeight: number;
  sidebarW: number;
  sidebarPad: number;
  mainPad: number;
  contentX: number;
  contentW: number;
  marginTop: number;
  marginBottom: number;
  bottomSafeY: number;
  y: number;
  pageIndex: number;
};

type TechSidebarTextStyle = {
  size: number;
  color: [number, number, number];
  fontStyle?: 'normal' | 'bold' | 'italic';
  lineHeight: number;
};

type TsBulletPart = { isBullet: boolean; lines: string[] };

const TS_NAVY: [number, number, number] = [15, 23, 42];
const TS_NAVY_SOFT: [number, number, number] = [30, 41, 59];
const TS_BLUE: [number, number, number] = [37, 99, 235];
const TS_BLUE_LIGHT: [number, number, number] = [96, 165, 250];
const TS_RULE: [number, number, number] = [191, 219, 254];
const TS_TEXT: [number, number, number] = [17, 24, 39];
const TS_BODY: [number, number, number] = [55, 65, 81];
const TS_MUTED: [number, number, number] = [100, 116, 139];
const TS_SIDEBAR_MUTED: [number, number, number] = [148, 163, 184];
const TS_SIDEBAR_TEXT: [number, number, number] = [226, 232, 240];
const TS_SIDEBAR_RULE: [number, number, number] = [51, 65, 85];
const TS_PHOTO_MM = 24;
const TS_BULLET_LINE_H = 3.7;

export function getTechSidebarPdfLabels(locale: Locale) {
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

function tsSetTextStyle(ctx: TechSidebarDirectPdfContext, style: TechSidebarTextStyle): void {
  ctx.pdf.setFont('helvetica', style.fontStyle ?? 'normal');
  ctx.pdf.setFontSize(style.size);
  ctx.pdf.setTextColor(style.color[0], style.color[1], style.color[2]);
}

function tsSplitText(ctx: TechSidebarDirectPdfContext, text: string, maxWidth = ctx.contentW): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const result = ctx.pdf.splitTextToSize(normalized, maxWidth);
  return Array.isArray(result) ? result.map(String) : [String(result)];
}

function tsFreshPageCapacity(ctx: TechSidebarDirectPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

function tsFillSidebarBackground(ctx: TechSidebarDirectPdfContext): void {
  ctx.pdf.setFillColor(TS_NAVY[0], TS_NAVY[1], TS_NAVY[2]);
  ctx.pdf.rect(0, 0, ctx.sidebarW, ctx.pageHeight, 'F');
}

function tsDrawContinuationSidebar(ctx: TechSidebarDirectPdfContext): void {
  tsFillSidebarBackground(ctx);
  const pad = ctx.sidebarPad;
  const innerW = ctx.sidebarW - pad * 2;
  let sy = ctx.marginTop;

  tsSetTextStyle(ctx, { size: 11, color: TS_SIDEBAR_TEXT, fontStyle: 'bold', lineHeight: 4.0 });
  for (const line of tsSplitText(ctx, ctx.cv.personal.fullName || 'Your Name', innerW).slice(0, 2)) {
    ctx.pdf.text(line, pad, sy);
    sy += 3.8;
  }

  if (ctx.cv.personal.jobTitle) {
    tsSetTextStyle(ctx, { size: 8, color: TS_BLUE_LIGHT, fontStyle: 'bold', lineHeight: 3.3 });
    ctx.pdf.text(
      tsSplitText(ctx, ctx.cv.personal.jobTitle, innerW)[0] ?? ctx.cv.personal.jobTitle,
      pad,
      sy,
    );
    sy += 3.6;
  }

  sy += 2;
  ctx.pdf.setDrawColor(TS_SIDEBAR_RULE[0], TS_SIDEBAR_RULE[1], TS_SIDEBAR_RULE[2]);
  ctx.pdf.setLineWidth(0.3);
  ctx.pdf.line(pad, sy, ctx.sidebarW - pad, sy);
  sy += 4;

  tsSetTextStyle(ctx, { size: 6.5, color: TS_SIDEBAR_MUTED, fontStyle: 'bold', lineHeight: 3.0 });
  ctx.pdf.text('CONTINUED', pad, sy);
}

export function tsCreateContext(
  pdf: TechSidebarPdfWriter,
  cv: CVData,
  locale: Locale,
): TechSidebarDirectPdfContext {
  const sidebarW = 62;
  const sidebarPad = 6;
  const mainPad = 12;
  const contentX = sidebarW + mainPad;
  const contentW = CV_PDF_A4_WIDTH_MM - contentX - mainPad;
  const marginTop = 16;
  const marginBottom = 15;

  return {
    pdf,
    cv,
    locale,
    labels: getTechSidebarPdfLabels(locale),
    pageWidth: CV_PDF_A4_WIDTH_MM,
    pageHeight: CV_PDF_A4_HEIGHT_MM,
    sidebarW,
    sidebarPad,
    mainPad,
    contentX,
    contentW,
    marginTop,
    marginBottom,
    bottomSafeY: CV_PDF_A4_HEIGHT_MM - marginBottom,
    y: marginTop,
    pageIndex: 0,
  };
}

export function tsAddPage(ctx: TechSidebarDirectPdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
  tsDrawContinuationSidebar(ctx);
}

function tsEnsureSpace(ctx: TechSidebarDirectPdfContext, heightNeeded: number): void {
  if (ctx.y + heightNeeded <= ctx.bottomSafeY) return;
  tsAddPage(ctx);
}

function tsMoveToFreshPageIfNeeded(ctx: TechSidebarDirectPdfContext, blockHeight: number): void {
  if (blockHeight > tsFreshPageCapacity(ctx)) return;
  if (ctx.y + blockHeight > ctx.bottomSafeY) tsAddPage(ctx);
}

function tsSectionHeadingHeight(): number {
  return 9.0;
}

function tsDrawSectionHeading(ctx: TechSidebarDirectPdfContext, label: string): void {
  tsEnsureSpace(ctx, tsSectionHeadingHeight());
  tsSetTextStyle(ctx, { size: 7.8, color: TS_BLUE, fontStyle: 'bold', lineHeight: 3.8 });
  ctx.pdf.text(label.toUpperCase(), ctx.contentX, ctx.y);
  ctx.y += 4.2;
  ctx.pdf.setDrawColor(TS_RULE[0], TS_RULE[1], TS_RULE[2]);
  ctx.pdf.setLineWidth(0.3);
  ctx.pdf.line(ctx.contentX, ctx.y, ctx.pageWidth - ctx.mainPad, ctx.y);
  ctx.y += 4.0;
}

function tsDrawWrappedText(
  ctx: TechSidebarDirectPdfContext,
  lines: string[],
  style: TechSidebarTextStyle,
  opts: { x?: number; indentX?: number } = {},
): void {
  if (!lines.length) return;
  const x = opts.x ?? ctx.contentX + (opts.indentX ?? 0);
  for (const line of lines) {
    tsEnsureSpace(ctx, style.lineHeight);
    tsSetTextStyle(ctx, style);
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function tsSidebarSectionHeadingY(ctx: TechSidebarDirectPdfContext, label: string, y: number): number {
  tsSetTextStyle(ctx, { size: 7.2, color: TS_BLUE_LIGHT, fontStyle: 'bold', lineHeight: 3.2 });
  ctx.pdf.text(label.toUpperCase(), ctx.sidebarPad, y);
  const ruleY = y + 3.6;
  ctx.pdf.setDrawColor(TS_SIDEBAR_RULE[0], TS_SIDEBAR_RULE[1], TS_SIDEBAR_RULE[2]);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.sidebarPad, ruleY, ctx.sidebarW - ctx.sidebarPad, ruleY);
  return ruleY + 4.2;
}

function tsDrawSidebarSkills(ctx: TechSidebarDirectPdfContext, skills: string[], startY: number): number {
  const innerW = ctx.sidebarW - ctx.sidebarPad * 2;
  const gapX = 1.6;
  const gapY = 1.8;
  let x = ctx.sidebarPad;
  let y = startY;
  let rowH = 0;

  for (const skill of skills) {
    const padH = 1.8;
    const padV = 1.0;
    const lineH = 3.1;
    tsSetTextStyle(ctx, { size: 7.0, color: TS_SIDEBAR_TEXT, lineHeight: lineH });
    const textW = ctx.pdf.getTextWidth(skill);
    let chipW = textW + padH * 2;
    let chipH = lineH + padV;
    let lines = [skill];

    if (chipW > innerW) {
      lines = tsSplitText(ctx, skill, innerW - padH * 2);
      chipW = innerW;
      chipH = lines.length * lineH + padV;
    }

    if (x + chipW > ctx.sidebarPad + innerW && x > ctx.sidebarPad) {
      x = ctx.sidebarPad;
      y += rowH + gapY;
      rowH = 0;
    }

    ctx.pdf.setFillColor(TS_NAVY_SOFT[0], TS_NAVY_SOFT[1], TS_NAVY_SOFT[2]);
    ctx.pdf.rect(x, y - lineH + 0.4, chipW, chipH, 'F');
    lines.forEach((line, index) => {
      ctx.pdf.text(line, x + padH, y + index * lineH);
    });

    x += chipW + gapX;
    rowH = Math.max(rowH, chipH);
    if (x > ctx.sidebarPad + innerW - 1) {
      x = ctx.sidebarPad;
      y += rowH + gapY;
      rowH = 0;
    }
  }
  return y + rowH;
}

function tsDrawSidebarLanguages(ctx: TechSidebarDirectPdfContext, startY: number): number {
  const innerW = ctx.sidebarW - ctx.sidebarPad * 2;
  let y = startY;
  tsSetTextStyle(ctx, { size: 7.2, color: TS_SIDEBAR_TEXT, lineHeight: 3.3 });
  for (const language of ctx.cv.languages) {
    const label = `${getLocalizedCvLanguageName(language.name, ctx.locale)} / ${language.level}`;
    for (const line of tsSplitText(ctx, label, innerW)) {
      ctx.pdf.text(line, ctx.sidebarPad, y);
      y += 3.2;
    }
    y += 0.6;
  }
  return y;
}

function tsHasPhotoEnabled(cv: CVData): boolean {
  if (cv.personal.photoEnabled !== undefined) return cv.personal.photoEnabled;
  return cv.region !== 'US';
}

export function tsDrawPageOneSidebar(ctx: TechSidebarDirectPdfContext, photoDataUrl: string | null): void {
  tsFillSidebarBackground(ctx);
  const pad = ctx.sidebarPad;
  const innerW = ctx.sidebarW - pad * 2;
  let sy = ctx.marginTop;

  if (photoDataUrl && tsHasPhotoEnabled(ctx.cv)) {
    const photoX = (ctx.sidebarW - TS_PHOTO_MM) / 2;
    const photoY = sy;
    const cx = photoX + TS_PHOTO_MM / 2;
    const cy = photoY + TS_PHOTO_MM / 2;
    ctx.pdf.setDrawColor(TS_SIDEBAR_RULE[0], TS_SIDEBAR_RULE[1], TS_SIDEBAR_RULE[2]);
    ctx.pdf.setLineWidth(0.6);
    ctx.pdf.circle(cx, cy, TS_PHOTO_MM / 2 + 0.6, 'S');
    try {
      ctx.pdf.addImage(photoDataUrl, 'JPEG', photoX, photoY, TS_PHOTO_MM, TS_PHOTO_MM);
    } catch {
      try {
        ctx.pdf.addImage(photoDataUrl, 'PNG', photoX, photoY, TS_PHOTO_MM, TS_PHOTO_MM);
      } catch {
        // Keep export usable if jsPDF rejects an image data URL.
      }
    }
    sy += TS_PHOTO_MM + 6;
  }

  tsSetTextStyle(ctx, { size: 12.5, color: TS_SIDEBAR_TEXT, fontStyle: 'bold', lineHeight: 4.2 });
  for (const line of tsSplitText(ctx, ctx.cv.personal.fullName || 'Your Name', innerW)) {
    ctx.pdf.text(line, pad, sy);
    sy += 4.0;
  }

  if (ctx.cv.personal.jobTitle) {
    sy += 1;
    tsSetTextStyle(ctx, { size: 8.4, color: TS_BLUE_LIGHT, fontStyle: 'bold', lineHeight: 3.5 });
    for (const line of tsSplitText(ctx, ctx.cv.personal.jobTitle, innerW)) {
      ctx.pdf.text(line, pad, sy);
      sy += 3.4;
    }
  }

  const region = regionSettings[ctx.cv.region];
  const contacts = [
    ctx.cv.personal.email,
    ctx.cv.personal.phone,
    region.showAddress ? ctx.cv.personal.address : '',
  ].filter(Boolean) as string[];

  if (contacts.length > 0) {
    sy += 4;
    tsSetTextStyle(ctx, { size: 7.2, color: TS_SIDEBAR_MUTED, lineHeight: 3.2 });
    for (const contact of contacts) {
      for (const line of tsSplitText(ctx, contact, innerW)) {
        ctx.pdf.text(line, pad, sy);
        sy += 3.1;
      }
    }
  }

  if (ctx.cv.skills.length > 0) {
    sy += 5;
    sy = tsSidebarSectionHeadingY(ctx, ctx.labels.skills, sy);
    const localized = ctx.cv.skills.map(s => getLocalizedCvSkillName(s, ctx.locale));
    sy = tsDrawSidebarSkills(ctx, localized, sy) + 4;
  }

  if (ctx.cv.languages.length > 0) {
    sy = tsSidebarSectionHeadingY(ctx, ctx.labels.languages, sy);
    tsDrawSidebarLanguages(ctx, sy);
  }

  if (ctx.cv.certifications.length > 0) {
    sy += 4;
    sy = tsSidebarSectionHeadingY(ctx, ctx.labels.certifications, sy);
    tsSetTextStyle(ctx, { size: 7.2, color: TS_SIDEBAR_TEXT, lineHeight: 3.2 });
    for (const cert of ctx.cv.certifications) {
      for (const line of tsSplitText(ctx, cert, innerW)) {
        ctx.pdf.text(line, pad, sy);
        sy += 3.1;
      }
    }
  }
}

function tsSummaryParagraphBlocks(summary: string): string[] {
  const trimmed = summary.trim();
  if (!trimmed) return [];
  const paragraphs = trimmed
    .split(/\n\s*\n+/)
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs.map(part => splitCleanSimpleSummarySentenceRuns(part).join(' '));
  }
  return [splitCleanSimpleSummarySentenceRuns(trimmed.replace(/\s+/g, ' ')).join(' ')];
}

function tsDrawSummary(ctx: TechSidebarDirectPdfContext, summary: string): void {
  const blocks = tsSummaryParagraphBlocks(summary);
  if (!blocks.length) return;
  tsEnsureSpace(ctx, tsSectionHeadingHeight());
  tsDrawSectionHeading(ctx, ctx.labels.summary);
  const style: TechSidebarTextStyle = { size: 8.5, color: TS_BODY, lineHeight: 4.0 };
  blocks.forEach((block, index) => {
    tsDrawWrappedText(ctx, tsSplitText(ctx, block), style);
    if (index < blocks.length - 1) ctx.y += 2.5;
  });
  ctx.y += 5;
}

function tsDirectDateRange(start: string, end: string, present: boolean, presentLabel: string): string {
  return [start, present ? presentLabel : end].filter(Boolean).join(' - ');
}

function tsExpandExperienceDescriptionLines(description: string): string[] {
  const rawLines = description.split(/\n+/).map(part => part.trim()).filter(Boolean);
  const expanded: string[] = [];
  for (const line of rawLines) {
    const normalizedLine = line
      .replace(/\.(\s*(?:[-•*]|\d+\.)\s+)/g, '.\n$1')
      .replace(/([.!?…])([A-ZÀ-ÖØ-ÞЀ-Я])/g, '$1\n$2');
    const segments = normalizedLine
      .split(/\n+/)
      .flatMap(segment => segment.split(/(?=(?:^|\s)(?:[-•*]|\d+\.)\s+)/))
      .map(segment => segment.trim())
      .filter(Boolean);
    for (const segment of segments) {
      const bulletMatch = segment.match(/^(?:[-•*]|\d+\.)\s+(.*)$/);
      const text = (bulletMatch?.[1] ?? segment).replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const normalized = splitCleanSimpleSummarySentenceRuns(text).join(' ').trim();
      if (!normalized) continue;
      expanded.push(bulletMatch ? `- ${normalized}` : normalized);
    }
  }
  return expanded;
}

function tsExperienceDescriptionParts(ctx: TechSidebarDirectPdfContext, entry: CVData['experience'][number]): TsBulletPart[] {
  const bulletIndent = 4;
  const textW = ctx.contentW - bulletIndent;
  return tsExpandExperienceDescriptionLines(entry.description).map((part) => {
    const cleaned = part.replace(/^(?:[-•*]|\d+\.)\s+/, '');
    const isBullet = cleaned !== part;
    return {
      isBullet,
      lines: tsSplitText(ctx, cleaned, textW - (isBullet ? bulletIndent : 0)),
    };
  });
}

function tsMeasurePartHeight(part: TsBulletPart): number {
  return part.lines.length * TS_BULLET_LINE_H;
}

function tsMeasureExperienceHeaderHeight(ctx: TechSidebarDirectPdfContext, entry: CVData['experience'][number]): number {
  const dateReserve = 30;
  const titleLines = tsSplitText(ctx, entry.position, ctx.contentW - dateReserve);
  let h = Math.max(4.0, titleLines.length * 4.0);
  if (entry.company) h += 3.4;
  return h + 1.0;
}

function tsExperienceLeadBlockHeight(ctx: TechSidebarDirectPdfContext, entry: CVData['experience'][number]): number {
  const parts = tsExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(p => p.isBullet);
  const leadParts = (bulletParts.length ? bulletParts : parts).slice(0, 2);
  return tsMeasureExperienceHeaderHeight(ctx, entry)
    + leadParts.reduce((sum, p) => sum + tsMeasurePartHeight(p), 0);
}

function tsExperienceEntryHeight(ctx: TechSidebarDirectPdfContext, entry: CVData['experience'][number]): number {
  const parts = tsExperienceDescriptionParts(ctx, entry);
  return tsMeasureExperienceHeaderHeight(ctx, entry)
    + parts.reduce((sum, p) => sum + tsMeasurePartHeight(p), 0)
    + 3.5;
}

function tsDrawExperienceEntryHeader(ctx: TechSidebarDirectPdfContext, entry: CVData['experience'][number]): void {
  const dateText = tsDirectDateRange(entry.startDate, entry.endDate, entry.isPresent, ctx.labels.present);
  const dateReserve = 30;
  const headerH = tsMeasureExperienceHeaderHeight(ctx, entry);
  tsEnsureSpace(ctx, headerH);
  const startY = ctx.y;

  tsSetTextStyle(ctx, { size: 9.6, color: TS_TEXT, fontStyle: 'bold', lineHeight: 4.0 });
  for (const line of tsSplitText(ctx, entry.position, ctx.contentW - dateReserve)) {
    ctx.pdf.text(line, ctx.contentX, ctx.y);
    ctx.y += 4.0;
  }

  if (dateText) {
    tsSetTextStyle(ctx, { size: 7.4, color: TS_MUTED, lineHeight: 3.2 });
    const dateX = ctx.pageWidth - ctx.mainPad - ctx.pdf.getTextWidth(dateText);
    ctx.pdf.text(dateText, dateX, startY + 0.5);
  }

  if (entry.company) {
    tsSetTextStyle(ctx, { size: 8.0, color: TS_BLUE, fontStyle: 'bold', lineHeight: 3.4 });
    ctx.pdf.text(entry.company, ctx.contentX, ctx.y);
    ctx.y += 3.4;
  }
  ctx.y += 1.0;
}

function tsDrawContinuationHeader(ctx: TechSidebarDirectPdfContext, entry: CVData['experience'][number]): void {
  tsEnsureSpace(ctx, 4.5);
  tsSetTextStyle(ctx, { size: 7.8, color: TS_TEXT, fontStyle: 'italic', lineHeight: 3.8 });
  ctx.pdf.text(`${entry.position} (continued)`, ctx.contentX, ctx.y);
  ctx.y += 4.5;
}

function tsDrawBulletAtomic(
  ctx: TechSidebarDirectPdfContext,
  entry: CVData['experience'][number],
  part: TsBulletPart,
  continuation: { shown: boolean },
): void {
  if (!part.lines.length) return;
  const blockH = tsMeasurePartHeight(part);
  if (ctx.y + blockH > ctx.bottomSafeY) {
    tsAddPage(ctx);
    if (!continuation.shown) {
      tsDrawContinuationHeader(ctx, entry);
      continuation.shown = true;
    }
  }

  part.lines.forEach((line, index) => {
    if (part.isBullet && index === 0) {
      tsSetTextStyle(ctx, { size: 8.0, color: TS_BLUE, lineHeight: TS_BULLET_LINE_H });
      ctx.pdf.text('-', ctx.contentX, ctx.y);
      tsSetTextStyle(ctx, { size: 8.0, color: TS_BODY, lineHeight: TS_BULLET_LINE_H });
      ctx.pdf.text(line, ctx.contentX + 4, ctx.y);
    } else if (part.isBullet) {
      tsSetTextStyle(ctx, { size: 8.0, color: TS_BODY, lineHeight: TS_BULLET_LINE_H });
      ctx.pdf.text(line, ctx.contentX + 4, ctx.y);
    } else {
      tsSetTextStyle(ctx, { size: 8.0, color: TS_BODY, lineHeight: TS_BULLET_LINE_H });
      ctx.pdf.text(line, ctx.contentX, ctx.y);
    }
    ctx.y += TS_BULLET_LINE_H;
  });
}

function tsDrawBulletAtomicNoBreak(ctx: TechSidebarDirectPdfContext, part: TsBulletPart): void {
  if (!part.lines.length) return;
  part.lines.forEach((line, index) => {
    if (part.isBullet && index === 0) {
      tsSetTextStyle(ctx, { size: 8.0, color: TS_BLUE, lineHeight: TS_BULLET_LINE_H });
      ctx.pdf.text('-', ctx.contentX, ctx.y);
      tsSetTextStyle(ctx, { size: 8.0, color: TS_BODY, lineHeight: TS_BULLET_LINE_H });
      ctx.pdf.text(line, ctx.contentX + 4, ctx.y);
    } else if (part.isBullet) {
      tsSetTextStyle(ctx, { size: 8.0, color: TS_BODY, lineHeight: TS_BULLET_LINE_H });
      ctx.pdf.text(line, ctx.contentX + 4, ctx.y);
    } else {
      tsSetTextStyle(ctx, { size: 8.0, color: TS_BODY, lineHeight: TS_BULLET_LINE_H });
      ctx.pdf.text(line, ctx.contentX, ctx.y);
    }
    ctx.y += TS_BULLET_LINE_H;
  });
}

function tsDrawExperienceEntryPaginated(ctx: TechSidebarDirectPdfContext, entry: CVData['experience'][number]): void {
  const parts = tsExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(p => p.isBullet);
  const leadParts = (bulletParts.length ? bulletParts : parts).slice(0, 2);
  const tailParts = (bulletParts.length ? bulletParts : parts).slice(leadParts.length);
  const allParts = [...leadParts, ...tailParts];

  const headerH = tsMeasureExperienceHeaderHeight(ctx, entry);
  const leadBlockH = headerH + leadParts.reduce((sum, p) => sum + tsMeasurePartHeight(p), 0);
  const fullEntryH = tsExperienceEntryHeight(ctx, entry);
  const remaining = ctx.bottomSafeY - ctx.y;
  const freshCap = tsFreshPageCapacity(ctx);
  const continuation = { shown: false };

  if (fullEntryH <= remaining) {
    tsDrawExperienceEntryHeader(ctx, entry);
    for (const part of allParts) tsDrawBulletAtomicNoBreak(ctx, part);
    ctx.y += 3.5;
    return;
  }

  if (leadBlockH > remaining && leadBlockH <= freshCap) {
    tsAddPage(ctx);
  }

  tsDrawExperienceEntryHeader(ctx, entry);
  for (const part of allParts) {
    tsDrawBulletAtomic(ctx, entry, part, continuation);
  }
  ctx.y += 3.5;
}

function tsDrawExperienceSection(ctx: TechSidebarDirectPdfContext): void {
  if (!ctx.cv.experience.length) return;
  const leadH = tsSectionHeadingHeight() + tsExperienceLeadBlockHeight(ctx, ctx.cv.experience[0]);
  tsMoveToFreshPageIfNeeded(ctx, leadH);
  tsDrawSectionHeading(ctx, ctx.labels.experience);
  for (const entry of ctx.cv.experience) {
    tsDrawExperienceEntryPaginated(ctx, entry);
  }
  ctx.y += 2;
}

function tsEducationEntryHeight(ctx: TechSidebarDirectPdfContext, edu: CVData['education'][number]): number {
  const degreeH = Math.max(4.0, tsSplitText(ctx, edu.degree, ctx.contentW - 30).length * 4.0);
  const schoolH = edu.school ? 3.4 : 0;
  const descH = edu.description ? tsSplitText(ctx, edu.description).length * 3.7 + 1 : 0;
  return degreeH + schoolH + descH + 2.5;
}

function tsDrawEducationSection(ctx: TechSidebarDirectPdfContext): void {
  if (!ctx.cv.education.length) return;
  const headingPlusFirst = tsSectionHeadingHeight() + tsEducationEntryHeight(ctx, ctx.cv.education[0]);
  tsMoveToFreshPageIfNeeded(ctx, headingPlusFirst);
  tsDrawSectionHeading(ctx, ctx.labels.education);

  for (const edu of ctx.cv.education) {
    const entryH = tsEducationEntryHeight(ctx, edu);
    tsMoveToFreshPageIfNeeded(ctx, entryH);
    const dateText = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
    const startY = ctx.y;

    tsSetTextStyle(ctx, { size: 9.4, color: TS_TEXT, fontStyle: 'bold', lineHeight: 4.0 });
    ctx.pdf.text(edu.degree, ctx.contentX, ctx.y);
    ctx.y += 4.0;

    if (dateText) {
      tsSetTextStyle(ctx, { size: 7.4, color: TS_MUTED, lineHeight: 3.2 });
      const dateX = ctx.pageWidth - ctx.mainPad - ctx.pdf.getTextWidth(dateText);
      ctx.pdf.text(dateText, dateX, startY + 0.5);
    }

    if (edu.school) {
      tsSetTextStyle(ctx, { size: 7.6, color: TS_MUTED, lineHeight: 3.4 });
      ctx.pdf.text(edu.school, ctx.contentX, ctx.y);
      ctx.y += 3.4;
    }

    if (edu.description) {
      tsDrawWrappedText(ctx, tsSplitText(ctx, edu.description), { size: 7.8, color: TS_BODY, lineHeight: 3.7 });
    }
    ctx.y += 2.5;
  }
  ctx.y += 2;
}

export async function buildTechSidebarPagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const ctx = tsCreateContext(pdf, cv, locale);

  tsDrawPageOneSidebar(ctx, options.photoDataUrl ?? null);
  tsDrawSummary(ctx, cv.summary);
  tsDrawExperienceSection(ctx);
  tsDrawEducationSection(ctx);

  const output = pdf.output('blob');
  return output instanceof Blob ? output : new Blob([output], { type: 'application/pdf' });
}
