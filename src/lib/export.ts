import type { CVData } from './types';
import { regionSettings } from './types';
import { translations, type Locale } from './i18n/translations';
import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { isNative } from './iap';
import { saveFileViaPlatform, pdfToBlob } from './native-save';
import { printNativePdf } from './native-print';

// ─── Clipboard Export ────────────────────────────────────────────────────────

export function exportToClipboard(elementId: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return Promise.resolve();
  const text = (element as HTMLElement).innerText;
  return navigator.clipboard.writeText(text);
}

// ─── DOCX Template Config ────────────────────────────────────────────────────

type DocxLayout = 'single' | 'sidebar-left' | 'dark-header' | 'centered-dark-header';

interface DocxTemplateConfig {
  /** Primary accent color (hex, no #) */
  accent: string;
  /** Header/sidebar background color for dark layouts */
  headerBg: string;
  /** Header text color for dark layouts */
  headerText: string;
  /** Job title color */
  titleColor: string;
  /** Section heading color */
  headingColor: string;
  /** Section heading border color */
  headingBorder: string;
  /** Layout variant */
  layout: DocxLayout;
  /** Sidebar width as percentage (sidebar-left layouts) */
  sidebarPct: number;
  /** Photo shape: 'circle' (circular PNG, transparent corners) | 'portrait' (3:4 rect) */
  photoShape: 'circle' | 'portrait';
  /** Photo width in EMU units (docx) */
  photoSize: number;
  /** Set true to completely suppress photo in DOCX (template does not support photos) */
  noPhoto?: boolean;
  /** Font family */
  font: string;
  /** FIX-01: Which side the photo appears on in single/dark-header layouts */
  photoSide?: 'left' | 'right';
  /** FIX-02: Header alignment for single-layout templates */
  headerAlignment?: 'left' | 'center';
  /** FIX-05: Whether section headings have an underline border */
  showHeadingBorder?: boolean;
  /** FIX-05: Whether section headings are rendered UPPERCASE */
  uppercaseHeadings?: boolean;
  /** FIX-06: Whether to render a colored accent bar below the dark header */
  accentBar?: boolean;
  /** FIX-07: Whether to render an amber decorative divider after the name */
  amberDivider?: boolean;
  /** FIX-08: Whether to render experience/education dates right-aligned */
  rightAlignDates?: boolean;
  /** FIX-10: Divider rule color (hex, no #); defaults to CCCCCC */
  dividerColor?: string;
  /** Dedicated named layout for templates that need custom rendering beyond the 4 generic layouts */
  customLayout?: 'professional-classic' | 'creative-artistic' | 'elegant-formal' | 'executive-premium' | 'nordic-clean' | 'tech-sidebar' | 'corporate-navy' | 'modern-minimal-executive' | 'contemporary-bold';
}

const DOCX_TEMPLATE_CONFIGS: Record<string, DocxTemplateConfig> = {
  'modern-minimal': {
    accent: '4F46E5', headerBg: 'FFFFFF', headerText: '111827',
    titleColor: '4F46E5', headingColor: '4F46E5', headingBorder: '4F46E5',
    layout: 'single', sidebarPct: 0, photoShape: 'circle', photoSize: 110, font: 'Calibri',
    photoSide: 'right', headerAlignment: 'left', showHeadingBorder: true, uppercaseHeadings: true,
  },
  'ats-standard': {
    // FIX-02: centered header; FIX-03: gray headings, not indigo
    // noPhoto: ATS Standard template never displays a profile photo
    accent: '374151', headerBg: 'FFFFFF', headerText: '111827',
    titleColor: '374151', headingColor: '111827', headingBorder: 'D1D5DB',
    layout: 'single', sidebarPct: 0, photoShape: 'circle', photoSize: 110, font: 'Calibri',
    photoSide: 'right', headerAlignment: 'center', showHeadingBorder: true, uppercaseHeadings: true,
    noPhoto: true,
  },
  'modern-minimal-executive': {
    accent: '4F46E5', headerBg: 'FFFFFF', headerText: '111827',
    titleColor: '4F46E5', headingColor: '4F46E5', headingBorder: '4F46E5',
    layout: 'single', sidebarPct: 0, photoShape: 'circle', photoSize: 110, font: 'Calibri',
    photoSide: 'right', headerAlignment: 'left', showHeadingBorder: true, uppercaseHeadings: true,
    customLayout: 'modern-minimal-executive',
  },
  'clean-simple': {
    // FIX-01: photo on left side to match HTML template
    accent: '059669', headerBg: 'FFFFFF', headerText: '111827',
    titleColor: '059669', headingColor: '059669', headingBorder: 'D1D5DB',
    layout: 'single', sidebarPct: 0, photoShape: 'circle', photoSize: 80, font: 'Calibri',
    photoSide: 'left', headerAlignment: 'left', showHeadingBorder: true, uppercaseHeadings: true,
    dividerColor: 'D1D5DB',
  },
  'professional-classic': {
    // Dedicated layout: slate-800 header, photo left, position/date right-aligned, 2-col skills+langs
    accent: '475569', headerBg: '1E293B', headerText: 'FFFFFF',
    titleColor: 'CBD5E1', headingColor: '1E293B', headingBorder: 'E2E8F0',
    layout: 'dark-header', sidebarPct: 0, photoShape: 'circle', photoSize: 90, font: 'Calibri',
    photoSide: 'left', showHeadingBorder: true, uppercaseHeadings: true,
    customLayout: 'professional-classic',
  },
  'elegant-formal': {
    // Dedicated layout: photo left + info centered, amber UPPERCASE tracking headings,
    // italic centered summary, position/date row, company in amber, education centered,
    // skills/languages/certifications in 3-column grid
    accent: 'B45309', headerBg: 'FFFFFF', headerText: '1F2937',
    titleColor: 'B45309', headingColor: 'B45309', headingBorder: 'D1D5DB',
    layout: 'single', sidebarPct: 0, photoShape: 'portrait', photoSize: 90, font: 'Times New Roman',
    customLayout: 'elegant-formal',
  },
  'creative-bold': {
    accent: 'E11D48', headerBg: 'BE123C', headerText: 'FFFFFF',
    titleColor: 'FECDD3', headingColor: 'E11D48', headingBorder: 'FECDD3',
    layout: 'sidebar-left', sidebarPct: 33, photoShape: 'circle', photoSize: 100, font: 'Calibri',
    showHeadingBorder: false, uppercaseHeadings: true,
  },
  'creative-artistic': {
    // Dedicated layout: violet/fuchsia gradient-style header, photo left, left-border accent on exp,
    // summary no-heading, skills+langs 2-column, purple accent throughout
    accent: '7C3AED', headerBg: '7C3AED', headerText: 'FFFFFF',
    titleColor: 'DDD6FE', headingColor: '7C3AED', headingBorder: 'DDD6FE',
    layout: 'dark-header', sidebarPct: 0, photoShape: 'circle', photoSize: 100, font: 'Calibri',
    showHeadingBorder: false, uppercaseHeadings: false,
    customLayout: 'creative-artistic',
  },
  'executive-premium': {
    // Dedicated layout: navy header centered, amber divider, gold title/contacts,
    // centered uppercase section headings, italic centered summary, 2-col skills+langs
    accent: 'D97706', headerBg: '111827', headerText: 'FFFFFF',
    titleColor: 'FCD34D', headingColor: '9CA3AF', headingBorder: 'E5E7EB',
    layout: 'centered-dark-header', sidebarPct: 0, photoShape: 'portrait', photoSize: 80, font: 'Georgia',
    showHeadingBorder: true, uppercaseHeadings: true, amberDivider: true,
    customLayout: 'executive-premium',
  },
  'nordic-clean': {
    // Dedicated layout: name left / circular photo right, teal job title, teal subtle divider,
    // full-width summary, right-aligned dates, skills as bullet-separated, languages as name / level
    accent: '0D9488', headerBg: 'FFFFFF', headerText: '111827',
    titleColor: '0D9488', headingColor: '0D9488', headingBorder: 'CCFBF1',
    layout: 'single', sidebarPct: 0, photoShape: 'circle', photoSize: 72, font: 'Calibri',
    photoSide: 'right', headerAlignment: 'left', showHeadingBorder: true, uppercaseHeadings: true,
    rightAlignDates: true, dividerColor: 'CCFBF1',
    customLayout: 'nordic-clean',
  },
  'tech-sidebar': {
    // Dedicated layout: dark sidebar 30%, white main 70%, square photo, nested skills/langs table
    accent: '60A5FA', headerBg: '0F172A', headerText: 'FFFFFF',
    titleColor: '60A5FA', headingColor: '2563EB', headingBorder: '334155',
    layout: 'sidebar-left', sidebarPct: 30, photoShape: 'circle', photoSize: 90, font: 'Calibri',
    showHeadingBorder: true, uppercaseHeadings: true, rightAlignDates: true,
    customLayout: 'tech-sidebar',
  },
  'corporate-navy': {
    // Dedicated layout: centered dark header, letter-spaced headings, 2-col skills, slash languages
    accent: '3B82F6', headerBg: '0F172A', headerText: 'FFFFFF',
    titleColor: '94A3B8', headingColor: '0F172A', headingBorder: 'E5E7EB',
    layout: 'dark-header', sidebarPct: 0, photoShape: 'circle', photoSize: 100, font: 'Calibri',
    showHeadingBorder: true, uppercaseHeadings: true, accentBar: true, rightAlignDates: true,
    customLayout: 'corporate-navy',
  },
  'contemporary-bold': {
    // Dedicated layout: left-aligned dark header, letter-spaced tracked headings,
    // stacked job title / company / date experience structure, 2-col skills, slash languages
    accent: '3B82F6', headerBg: '0F172A', headerText: 'FFFFFF',
    titleColor: '94A3B8', headingColor: '0F172A', headingBorder: 'E5E7EB',
    layout: 'dark-header', sidebarPct: 0, photoShape: 'circle', photoSize: 100, font: 'Calibri',
    showHeadingBorder: true, uppercaseHeadings: true, accentBar: true, rightAlignDates: true,
    customLayout: 'contemporary-bold',
  },
};

const DEFAULT_DOCX_CONFIG: DocxTemplateConfig = DOCX_TEMPLATE_CONFIGS['modern-minimal'];

function getDocxConfig(templateId?: string): DocxTemplateConfig {
  if (!templateId) return DEFAULT_DOCX_CONFIG;
  return DOCX_TEMPLATE_CONFIGS[templateId] ?? DEFAULT_DOCX_CONFIG;
}

// ─── DOCX Export ─────────────────────────────────────────────────────────────────────────────

export async function exportToDOCX(cvData: CVData, fileName: string, locale: Locale = 'en', templateId?: string): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    ImageRun,
    BorderStyle,
    TableRow,
    TableCell,
    Table,
    WidthType,
    VerticalAlign,
    AlignmentType,
    ShadingType,
  } = await import('docx');

  const cfg = getDocxConfig(templateId ?? cvData.templateId);
  const rs = regionSettings[cvData.region];
  const t = translations[locale];
  const showPhoto =
    cvData.personal.photoEnabled !== undefined
      ? cvData.personal.photoEnabled
      : cvData.region !== 'US';

  function dataUrlToBytes(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // Circular PNG crop: transparent outside the circle, same face-focus logic as preview.
  // Outputs PNG (not JPEG) so transparent corners are preserved in DOCX.
  function circularCropDataUrl(dataUrl: string, outputSize: number): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        const isPortrait = img.naturalHeight > img.naturalWidth;
        const scale = outputSize / Math.min(img.naturalWidth, img.naturalHeight);
        const scaledW = img.naturalWidth * scale;
        const scaledH = img.naturalHeight * scale;
        const sx = (outputSize - scaledW) / 2;
        const sy = isPortrait ? -(scaledH - outputSize) * 0.20 : (outputSize - scaledH) / 2;
        // Clip to circle before drawing — transparent outside
        ctx.beginPath();
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, sx, sy, scaledW, scaledH);
        // PNG preserves the transparent corners
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function portraitCropDataUrl(dataUrl: string, outW: number, outH: number): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        // Fill white first — eliminates any transparent pixels from circular PNG crops
        // so the exported JPEG has no black or white ring artifacts around the photo.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, outW, outH);
        const isPortrait = img.naturalHeight > img.naturalWidth;
        const scaleW = outW / img.naturalWidth;
        const scaleH = outH / img.naturalHeight;
        const scale = Math.max(scaleW, scaleH);
        const scaledW = img.naturalWidth * scale;
        const scaledH = img.naturalHeight * scale;
        const sx = (outW - scaledW) / 2;
        const sy = isPortrait ? -(scaledH - outH) * 0.20 : (outH - scaledH) / 2;
        ctx.drawImage(img, sx, sy, scaledW, scaledH);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }


  function sectionHeading(text: string) {
    // FIX-05: respect uppercaseHeadings and showHeadingBorder per template
    const label = cfg.uppercaseHeadings !== false ? text.toUpperCase() : text;
    const borderConfig = cfg.showHeadingBorder !== false
      ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.headingBorder } }
      : {};
    return new Paragraph({
      children: [new TextRun({ text: label, bold: true, size: 18, color: cfg.headingColor })],
      spacing: { before: 200, after: 100 },
      border: borderConfig,
    });
  }

  function sidebarSectionHeading(text: string) {
    return new Paragraph({
      children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 15, color: cfg.accent })],
      spacing: { before: 140, after: 60 },
    });
  }

  function divider() {
    // FIX-10: use per-template divider color if set
    const color = cfg.dividerColor ?? 'CCCCCC';
    return new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color } },
      spacing: { before: 80, after: 80 },
    });
  }

  // ── Pre-process photo ────────────────────────────────────────────────────────────────────────
  // cfg.noPhoto: template does not support photos at all — skip regardless of user setting
  const rawPhotoDataUrl = !cfg.noPhoto && showPhoto && cvData.personal.photo ? cvData.personal.photo : null;
  const ps = cfg.photoSize;
  let photoBytes: Uint8Array | null = null;
  let photoW = ps;
  let photoH = ps;

  // photoType tracks the DOCX ImageRun type — 'png' for circular (transparent),
  // 'jpg' for portrait rectangular crops.
  let photoType: 'png' | 'jpg' = 'png';

  if (rawPhotoDataUrl) {
    if (cfg.photoShape === 'portrait') {
      photoW = Math.round(ps * 0.75);
      photoH = ps;
      const cropped = await portraitCropDataUrl(rawPhotoDataUrl, photoW * 3, photoH * 3);
      photoBytes = dataUrlToBytes(cropped);
      photoType = 'jpg';
    } else {
      // 'circle': circular PNG crop with transparent corners — works correctly in DOCX/PDF.
      // Canvas clips to a circle path before drawing, then exports as PNG (not JPEG)
      // so corners are truly transparent, not white or black.
      const cropped = await circularCropDataUrl(rawPhotoDataUrl, 512);
      photoBytes = dataUrlToBytes(cropped);
      photoW = ps;
      photoH = ps;
      photoType = 'png';
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  const contacts: string[] = [];
  if (cvData.personal.email) contacts.push(cvData.personal.email);
  if (cvData.personal.phone) contacts.push(cvData.personal.phone);
  if (rs.showAddress && cvData.personal.address) contacts.push(cvData.personal.address);
  if (cvData.personal.dateOfBirth) contacts.push(cvData.personal.dateOfBirth);
  if (cvData.personal.nationality) contacts.push(cvData.personal.nationality);

  const noBorders = {
    top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  // FIX-08: render a row with job title/school on the left and date range on the right
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function dateRow(leftChildren: any[], dateText: string) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ children: leftChildren, spacing: { after: 20 } })] }),
        new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF', italics: true })], spacing: { after: 20 } })] }),
      ]})],
    });
  }

  // Shared content-section renderer (used by single, dark-header, centered-dark-header)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function appendContentSections(target: any[], italicSummary = false, centeredEdu = false, accentCompany = false) {
    const rightDates = cfg.rightAlignDates === true;
    if (cvData.summary) {
      target.push(sectionHeading(t.cv.summary));
      target.push(new Paragraph({ children: [new TextRun({ text: cvData.summary, size: 22, color: '374151', italics: italicSummary })], spacing: { after: 120 } }));
    }
    if (cvData.experience.length > 0) {
      target.push(sectionHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} – ${exp.isPresent ? t.cv.present : exp.endDate}`;
        if (rightDates) {
          // FIX-08: position / company on left, date on right
          target.push(dateRow([
            new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' }),
            new TextRun({ text: (accentCompany ? '  |  ' : '  —  ') + exp.company, size: 20, color: accentCompany ? cfg.accent : '6B7280' }),
          ], dateText));
        } else {
          target.push(new Paragraph({
            children: [
              new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' }),
              new TextRun({ text: (accentCompany ? '  |  ' : '  —  ') + exp.company, size: 20, color: accentCompany ? cfg.accent : '6B7280' }),
            ],
            spacing: { after: 40 },
          }));
          target.push(new Paragraph({
            children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF', italics: true })],
            spacing: { after: 60 },
          }));
        }
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            if (line.trim()) target.push(new Paragraph({ children: [new TextRun({ text: line, size: 22, color: '374151' })], spacing: { after: 40 } }));
          }
        }
        target.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      }
    }
    if (cvData.education.length > 0) {
      target.push(sectionHeading(t.cv.education));
      for (const edu of cvData.education) {
        if (centeredEdu) {
          target.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' })], spacing: { after: 20 } }));
          target.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: edu.school, size: 22, color: '6B7280' })], spacing: { after: 20 } }));
          if (edu.startDate || edu.endDate) {
            target.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${edu.startDate} – ${edu.endDate}`, size: 18, color: '9CA3AF', italics: true })], spacing: { after: 80 } }));
          }
        } else if (rightDates && (edu.startDate || edu.endDate)) {
          // FIX-08: degree + school on left, date on right
          target.push(dateRow([
            new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' }),
            new TextRun({ text: '  —  ' + edu.school, size: 20, color: '6B7280' }),
          ], `${edu.startDate} – ${edu.endDate}`));
          if (edu.description) {
            target.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 22, color: '374151' })], spacing: { after: 80 } }));
          }
        } else {
          target.push(new Paragraph({
            children: [
              new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' }),
              new TextRun({ text: '  —  ' + edu.school, size: 20, color: '6B7280' }),
            ],
            spacing: { after: 40 },
          }));
          if (edu.startDate || edu.endDate) {
            target.push(new Paragraph({ children: [new TextRun({ text: `${edu.startDate} – ${edu.endDate}`, size: 18, color: '9CA3AF', italics: true })], spacing: { after: 60 } }));
          }
          if (edu.description) {
            target.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 22, color: '374151' })], spacing: { after: 80 } }));
          }
        }
      }
    }
    if (cvData.skills.length > 0) {
      target.push(sectionHeading(t.cv.skills));
      const localizedSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
      target.push(new Paragraph({
        alignment: centeredEdu ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [new TextRun({ text: localizedSkills.join('  •  '), size: 22, color: '374151' })],
        spacing: { after: 100 },
      }));
    }
    if (cvData.languages.length > 0) {
      target.push(sectionHeading(t.cv.languages));
      for (const lang of cvData.languages) {
        if (centeredEdu) {
          target.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 22 }),
              new TextRun({ text: `  —  ${lang.level}`, size: 22, color: '6B7280' }),
            ],
            spacing: { after: 60 },
          }));
        } else {
          target.push(new Paragraph({
            children: [
              new TextRun({ text: `${getLocalizedCvLanguageName(lang.name, locale)}: `, bold: true, size: 22 }),
              new TextRun({ text: lang.level, size: 22 }),
            ],
            spacing: { after: 60 },
          }));
        }
      }
    }
    if (cvData.certifications.length > 0) {
      target.push(sectionHeading(t.cv.certifications));
      for (const cert of cvData.certifications) {
        target.push(new Paragraph({
          alignment: centeredEdu ? AlignmentType.CENTER : AlignmentType.LEFT,
          children: [
            ...(centeredEdu ? [] : [new TextRun({ text: '• ', size: 22, color: cfg.accent })]),
            new TextRun({ text: cert, size: 22, color: '374151' }),
          ],
          spacing: { after: 60 },
        }));
      }
    }
  }

  // ════ LAYOUT: professional-classic (dedicated) ════════════════════════════════════════════════
  // Matches the HTML template exactly:
  //   • slate-800 full-width header, photo 90×90 circle on left, name/title/contacts in header
  //   • sections: Summary, Experience (position left / date right, company below), Education,
  //     Skills + Languages side-by-side 2-column, Certifications
  if (cfg.customLayout === 'professional-classic') {
    const headerBg = { fill: cfg.headerBg, type: ShadingType.SOLID, color: cfg.headerBg };

    // ── Header ──────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headerInfoCells: any[] = [
      new Paragraph({ children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 44, color: 'FFFFFF' })], spacing: { after: 30 } }),
      new Paragraph({ children: [new TextRun({ text: cvData.personal.jobTitle || '', size: 22, color: 'CBD5E1' })], spacing: { after: 50 } }),
    ];
    if (contacts.length > 0) {
      headerInfoCells.push(new Paragraph({ children: contacts.map((c, i) => new TextRun({ text: (i > 0 ? '   ' : '') + c, size: 18, color: '94A3B8' })), spacing: { after: 0 } }));
    }
    if (cvData.personal.fathersName) {
      headerInfoCells.push(new Paragraph({ children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: '94A3B8' }), new TextRun({ text: cvData.personal.fathersName, size: 18, color: '94A3B8' })], spacing: { after: 0 } }));
    }

    if (photoBytes) {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 16, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: noBorders, shading: headerBg, margins: { top: 220, bottom: 220, left: 280, right: 160 }, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 0 } })] }),
          new TableCell({ width: { size: 84, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: noBorders, shading: headerBg, margins: { top: 220, bottom: 220, left: 160, right: 280 }, children: headerInfoCells }),
        ]})],
      }));
    } else {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [new TableCell({ width: { size: 100, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: noBorders, shading: headerBg, margins: { top: 220, bottom: 220, left: 280, right: 280 }, children: headerInfoCells })] })],
      }));
    }
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

    // ── Section heading helper (slate-800 color, gray underline border) ─────
    function pcHeading(text: string) {
      return new Paragraph({
        children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 18, color: '1E293B' })],
        spacing: { before: 240, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
      });
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    if (cvData.summary) {
      children.push(pcHeading(t.cv.summary));
      children.push(new Paragraph({ children: [new TextRun({ text: cvData.summary, size: 22, color: '374151' })], spacing: { after: 160 } }));
    }

    // ── Experience: position left / date right / company on next line ────────
    if (cvData.experience.length > 0) {
      children.push(pcHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} – ${exp.isPresent ? t.cv.present : exp.endDate}`;
        // Row: position (bold) left | date (gray italic) right
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ children: [new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' })], spacing: { after: 0 } })] }),
            new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF', italics: true })], spacing: { after: 0 } })] }),
          ]})],
        }));
        // Company on next line in gray
        children.push(new Paragraph({ children: [new TextRun({ text: exp.company, size: 20, color: '6B7280' })], spacing: { after: 50 } }));
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            if (line.trim()) children.push(new Paragraph({ children: [new TextRun({ text: line, size: 22, color: '4B5563' })], spacing: { after: 40 } }));
          }
        }
        children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      }
    }

    // ── Education ────────────────────────────────────────────────────────────
    if (cvData.education.length > 0) {
      children.push(pcHeading(t.cv.education));
      for (const edu of cvData.education) {
        children.push(new Paragraph({ children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' })], spacing: { after: 20 } }));
        const eduMeta = [edu.school, edu.startDate && edu.endDate ? `${edu.startDate} – ${edu.endDate}` : ''].filter(Boolean).join('  |  ');
        children.push(new Paragraph({ children: [new TextRun({ text: eduMeta, size: 18, color: '6B7280' })], spacing: { after: edu.description ? 40 : 80 } }));
        if (edu.description) children.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 22, color: '374151' })], spacing: { after: 80 } }));
      }
    }

    // ── Skills + Languages: side-by-side 2-column (matching grid-cols-2) ────
    const localizedSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
    const hasSkills = localizedSkills.length > 0;
    const hasLangs = cvData.languages.length > 0;
    if (hasSkills || hasLangs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skillsColChildren: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const langsColChildren: any[] = [];

      if (hasSkills) {
        skillsColChildren.push(pcHeading(t.cv.skills));
        skillsColChildren.push(new Paragraph({ children: [new TextRun({ text: localizedSkills.join('  •  '), size: 20, color: '374151' })], spacing: { after: 80 } }));
      }
      if (hasLangs) {
        langsColChildren.push(pcHeading(t.cv.languages));
        for (const lang of cvData.languages) {
          langsColChildren.push(new Paragraph({ children: [new TextRun({ text: `${getLocalizedCvLanguageName(lang.name, locale)}`, bold: true, size: 20, color: '111827' }), new TextRun({ text: `  –  ${lang.level}`, size: 20, color: '6B7280' })], spacing: { after: 40 } }));
        }
      }

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 200 }, children: skillsColChildren.length ? skillsColChildren : [new Paragraph({ text: '' })] }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 200, right: 0 }, children: langsColChildren.length ? langsColChildren : [new Paragraph({ text: '' })] }),
        ]})],
      }));
    }

    // ── Certifications ───────────────────────────────────────────────────────
    if (cvData.certifications.length > 0) {
      children.push(pcHeading(t.cv.certifications));
      for (const cert of cvData.certifications) {
        children.push(new Paragraph({ children: [new TextRun({ text: '• ', size: 22, color: '475569' }), new TextRun({ text: cert, size: 22, color: '374151' })], spacing: { after: 60 } }));
      }
    }
  }

  // ════ LAYOUT: creative-artistic (dedicated) ══════════════════════════════════════════════════
  // Matches the HTML template exactly:
  //   • violet/fuchsia solid header (gradient not possible in DOCX → solid violet-600 #7C3AED)
  //   • circular photo 100×100 on left of header; name, title, contacts to the right
  //   • summary: no section heading, plain paragraph below header
  //   • experience: violet heading (no underline), each entry with left purple border accent
  //     + company | date in violet-500 below position title
  //   • education: violet heading, degree bold, school gray
  //   • skills + languages: side-by-side 2-column grid
  else if (cfg.customLayout === 'creative-artistic') {
    const headerBg = { fill: cfg.headerBg, type: ShadingType.SOLID, color: cfg.headerBg };

    // ── Header ──────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const caHeaderInfo: any[] = [
      new Paragraph({ children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 52, color: 'FFFFFF' })], spacing: { after: 30 } }),
      new Paragraph({ children: [new TextRun({ text: cvData.personal.jobTitle || '', size: 26, color: 'DDD6FE' })], spacing: { after: 50 } }),
    ];
    if (contacts.length > 0) {
      caHeaderInfo.push(new Paragraph({ children: contacts.map((c, i) => new TextRun({ text: (i > 0 ? '    ' : '') + c, size: 18, color: 'DDD6FE' })), spacing: { after: 0 } }));
    }
    if (cvData.personal.fathersName) {
      caHeaderInfo.push(new Paragraph({ children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: 'DDD6FE' }), new TextRun({ text: cvData.personal.fathersName, size: 18, color: 'DDD6FE' })], spacing: { after: 0 } }));
    }

    if (photoBytes) {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 17, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: noBorders, shading: headerBg, margins: { top: 240, bottom: 240, left: 300, right: 160 }, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 0 } })] }),
          new TableCell({ width: { size: 83, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: noBorders, shading: headerBg, margins: { top: 240, bottom: 240, left: 160, right: 300 }, children: caHeaderInfo }),
        ]})],
      }));
    } else {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [new TableCell({ width: { size: 100, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: noBorders, shading: headerBg, margins: { top: 240, bottom: 240, left: 300, right: 300 }, children: caHeaderInfo })] })],
      }));
    }
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

    // ── Section heading helper: violet, no underline border, not uppercase ──
    function caHeading(text: string) {
      return new Paragraph({
        children: [new TextRun({ text, bold: true, size: 22, color: '7C3AED' })],
        spacing: { before: 240, after: 100 },
      });
    }

    // ── Summary: no heading, just the paragraph ─────────────────────────────
    if (cvData.summary) {
      children.push(new Paragraph({ children: [new TextRun({ text: cvData.summary, size: 22, color: '374151' })], spacing: { after: 200 } }));
    }

    // ── Experience: left purple border accent per entry ──────────────────────
    if (cvData.experience.length > 0) {
      children.push(caHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = exp.isPresent ? t.cv.present : exp.endDate;
        const metaLine = [exp.company, `${exp.startDate} – ${dateText}`].filter(Boolean).join('  |  ');
        // Position title with left violet border
        children.push(new Paragraph({
          children: [new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' })],
          spacing: { before: 60, after: 20 },
          border: { left: { style: BorderStyle.SINGLE, size: 14, color: 'DDD6FE' } },
          indent: { left: 160 },
        }));
        // Company | date in violet-500
        children.push(new Paragraph({
          children: [new TextRun({ text: metaLine, size: 18, color: '8B5CF6' })],
          spacing: { after: 40 },
          border: { left: { style: BorderStyle.SINGLE, size: 14, color: 'DDD6FE' } },
          indent: { left: 160 },
        }));
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            if (line.trim()) {
              children.push(new Paragraph({
                children: [new TextRun({ text: line, size: 20, color: '4B5563' })],
                spacing: { after: 30 },
                border: { left: { style: BorderStyle.SINGLE, size: 14, color: 'DDD6FE' } },
                indent: { left: 160 },
              }));
            }
          }
        }
        children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
      }
    }

    // ── Education: violet heading, degree bold, school gray ─────────────────
    if (cvData.education.length > 0) {
      children.push(caHeading(t.cv.education));
      for (const edu of cvData.education) {
        children.push(new Paragraph({ children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' })], spacing: { after: 20 } }));
        children.push(new Paragraph({ children: [new TextRun({ text: edu.school, size: 20, color: '6B7280' })], spacing: { after: edu.description ? 30 : 80 } }));
        if (edu.description) children.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 20, color: '374151' })], spacing: { after: 80 } }));
      }
    }

    // ── Skills + Languages: side-by-side 2-column ───────────────────────────
    const caLocalizedSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
    const caHasSkills = caLocalizedSkills.length > 0;
    const caHasLangs = cvData.languages.length > 0;
    if (caHasSkills || caHasLangs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caSkillsCol: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const caLangsCol: any[] = [];

      if (caHasSkills) {
        caSkillsCol.push(caHeading(t.cv.skills));
        // Pill-style: bullet-separated list (closest DOCX approximation to rounded tags)
        caSkillsCol.push(new Paragraph({
          children: caLocalizedSkills.map((s, i) => new TextRun({ text: (i > 0 ? '  • ' : '') + s, size: 20, color: '6D28D9' })),
          spacing: { after: 80 },
        }));
      }
      if (caHasLangs) {
        caLangsCol.push(caHeading(t.cv.languages));
        for (const lang of cvData.languages) {
          caLangsCol.push(new Paragraph({
            children: [
              new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 20, color: '111827' }),
              new TextRun({ text: `  –  ${lang.level}`, size: 20, color: '6B7280' }),
            ],
            spacing: { after: 40 },
          }));
        }
      }

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 200 }, children: caSkillsCol.length ? caSkillsCol : [new Paragraph({ text: '' })] }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 200, right: 0 }, children: caLangsCol.length ? caLangsCol : [new Paragraph({ text: '' })] }),
        ]})],
      }));
    }

    // ── Certifications ───────────────────────────────────────────────────────
    if (cvData.certifications.length > 0) {
      children.push(caHeading(t.cv.certifications));
      for (const cert of cvData.certifications) {
        children.push(new Paragraph({ children: [new TextRun({ text: '• ', size: 22, color: '7C3AED' }), new TextRun({ text: cert, size: 22, color: '374151' })], spacing: { after: 60 } }));
      }
    }
  }

  // ════ LAYOUT: elegant-formal (dedicated) ════════════════════════════════════════════════════
  // Matches the HTML template exactly:
  //   • White background, serif font, photo left (3:4 portrait) + name/title/contacts centered right
  //   • Bottom border under header separates it from body
  //   • All section headings: amber, UPPERCASE, centered, tiny tracking, bottom border (except bottom grid)
  //   • Summary: centered italic paragraph, no heading underline on that section
  //   • Experience: position/date on same line (right-aligned date), company in amber below
  //   • Education: centered degree + school | date
  //   • Bottom grid: Skills / Languages / Certifications in 3 equal columns, all centered
  else if (cfg.customLayout === 'elegant-formal') {
    // ── Header: photo left + info block centered ──────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const efInfoLines: any[] = [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', size: 48, color: '1F2937' })], spacing: { after: 30 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (cvData.personal.jobTitle || '').toUpperCase(), size: 17, color: 'B45309', bold: true })], spacing: { after: 50 } }),
    ];
    if (contacts.length > 0) {
      efInfoLines.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: contacts.join('   '), size: 17, color: '9CA3AF' })], spacing: { after: 0 } }));
    }
    if (cvData.personal.fathersName) {
      efInfoLines.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 17, color: '9CA3AF' }), new TextRun({ text: cvData.personal.fathersName, size: 17, color: '9CA3AF' })], spacing: { after: 0 } }));
    }

    if (photoBytes) {
      const photoCell = new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 0 } })] });
      const infoCell = new TableCell({ width: { size: 82, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: noBorders, children: efInfoLines });
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ children: [photoCell, infoCell] })] }));
    } else {
      children.push(...efInfoLines);
    }
    // Header bottom border separator
    children.push(new Paragraph({ text: '', spacing: { before: 160, after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' } } }));

    // ── Section heading helper: amber, UPPERCASE, centered, bottom border ─
    function efHeading(text: string, withBorder = true) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 17, color: 'B45309' })],
        spacing: { before: 240, after: 80 },
        ...(withBorder ? { border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } } } : {}),
      });
    }

    // ── Summary: centered italic, no section border on the heading ─────────
    if (cvData.summary) {
      children.push(efHeading(t.cv.summary, false));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cvData.summary, size: 22, color: '374151', italics: true })], spacing: { after: 200 } }));
    }

    // ── Experience: position/date row, company in amber below ──────────────
    if (cvData.experience.length > 0) {
      children.push(efHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} – ${exp.isPresent ? t.cv.present : exp.endDate}`;
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ children: [new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' })], spacing: { after: 0 } })] }),
            new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: dateText, size: 17, color: '9CA3AF', italics: true })], spacing: { after: 0 } })] }),
          ]})],
        }));
        children.push(new Paragraph({ children: [new TextRun({ text: exp.company, size: 18, color: 'B45309' })], spacing: { after: 50 } }));
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            if (line.trim()) children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20, color: '4B5563' })], spacing: { after: 40 } }));
          }
        }
        children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      }
    }

    // ── Education: centered degree + school | date ─────────────────────────
    if (cvData.education.length > 0) {
      children.push(efHeading(t.cv.education));
      for (const edu of cvData.education) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' })], spacing: { after: 20 } }));
        const eduMeta = [edu.school, edu.startDate && edu.endDate ? `${edu.startDate} – ${edu.endDate}` : ''].filter(Boolean).join('  |  ');
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: eduMeta, size: 18, color: '6B7280' })], spacing: { after: 80 } }));
      }
    }

    // ── Bottom 3-column grid: Skills | Languages | Certifications ──────────
    const efSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
    const efHasSkills = efSkills.length > 0;
    const efHasLangs = cvData.languages.length > 0;
    const efHasCerts = cvData.certifications.length > 0;
    if (efHasSkills || efHasLangs || efHasCerts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function efColHeading(text: string): any {
        return new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 16, color: 'B45309' })], spacing: { before: 160, after: 80 } });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skillsCol: any[] = efHasSkills
        ? [efColHeading(t.cv.skills), ...efSkills.map(s => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s, size: 18, color: '4B5563' })], spacing: { after: 30 } }))]
        : [new Paragraph({ text: '' })];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const langsCol: any[] = efHasLangs
        ? [efColHeading(t.cv.languages), ...cvData.languages.map(l => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${getLocalizedCvLanguageName(l.name, locale)} (${l.level})`, size: 18, color: '4B5563' })], spacing: { after: 30 } }))]
        : [new Paragraph({ text: '' })];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const certsCol: any[] = efHasCerts
        ? [efColHeading(t.cv.certifications), ...cvData.certifications.map(c => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: c, size: 18, color: '4B5563' })], spacing: { after: 30 } }))]
        : [new Paragraph({ text: '' })];

      children.push(new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } }, text: '', spacing: { before: 160, after: 0 } }));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 120 }, children: skillsCol }),
          new TableCell({ width: { size: 34, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 120, right: 120 }, children: langsCol }),
          new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 120, right: 0 }, children: certsCol }),
        ]})],
      }));
    }
  }

  // ════ LAYOUT: nordic-clean (dedicated) ══════════════════════════════════════════════════════
  // Matches the HTML template exactly:
  //   • White background, Calibri, name left (font-light text-3xl), teal job title, gray contacts
  //   • Circular photo 72×72 right-aligned, vertically aligned to TOP of header
  //   • Thin teal divider line below header (CCFBF1 color)
  //   • No summary heading — just the paragraph
  //   • Section headings: tiny teal (0D9488) UPPERCASE tracked, with subtle teal bottom border
  //   • Experience: position bold left / date right, company gray below, description
  //   • Education: degree bold left / date right, school gray below
  //   • Bottom 2-column grid: Skills (pill-bullet) | Languages (name / level)
  else if (cfg.customLayout === 'nordic-clean') {
    const rs = regionSettings[cvData.region];

    // ── Header: name+title+contacts left | circular photo right ──────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ncInfoLines: any[] = [
      new Paragraph({ children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', size: 36, color: '111827' })], spacing: { after: 30 } }),
      new Paragraph({ children: [new TextRun({ text: cvData.personal.jobTitle || '', size: 20, color: '0D9488' })], spacing: { after: 40 } }),
    ];
    const ncContacts: string[] = [];
    if (cvData.personal.email) ncContacts.push(cvData.personal.email);
    if (cvData.personal.phone) ncContacts.push(cvData.personal.phone);
    if (rs.showAddress && cvData.personal.address) ncContacts.push(cvData.personal.address);
    if (cvData.personal.dateOfBirth) ncContacts.push(cvData.personal.dateOfBirth);
    if (cvData.personal.nationality) ncContacts.push(cvData.personal.nationality);
    if (ncContacts.length > 0) {
      ncInfoLines.push(new Paragraph({ children: ncContacts.map((c, i) => new TextRun({ text: (i > 0 ? '   ' : '') + c, size: 16, color: '9CA3AF' })), spacing: { after: 0 } }));
    }
    if (cvData.personal.fathersName) {
      ncInfoLines.push(new Paragraph({ children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 16, color: '9CA3AF' }), new TextRun({ text: cvData.personal.fathersName, size: 16, color: '9CA3AF' })], spacing: { after: 0 } }));
    }

    if (photoBytes) {
      const infoCell = new TableCell({ width: { size: 82, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 160 }, children: ncInfoLines });
      const photoCell = new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 0 } })] });
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ children: [infoCell, photoCell] })] }));
    } else {
      children.push(...ncInfoLines);
    }

    // Thin teal divider after header
    children.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCFBF1' } },
      text: '',
      spacing: { before: 120, after: 120 },
    }));

    // ── Section heading helper: tiny teal UPPERCASE, subtle bottom border ─
    function ncHeading(text: string) {
      return new Paragraph({
        children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 14, color: '0D9488' })],
        spacing: { before: 200, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCFBF1' } },
      });
    }

    // ── Summary: no heading, plain paragraph ─────────────────────────────
    if (cvData.summary) {
      children.push(new Paragraph({ children: [new TextRun({ text: cvData.summary, size: 20, color: '4B5563' })], spacing: { after: 160 } }));
    }

    // ── Experience: position/date row + company below ─────────────────────
    if (cvData.experience.length > 0) {
      children.push(ncHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} – ${exp.isPresent ? t.cv.present : exp.endDate}`;
        // Position bold left | date right
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ children: [new TextRun({ text: exp.position, bold: true, size: 20, color: '111827' })], spacing: { after: 0 } })] }),
            new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: dateText, size: 16, color: '9CA3AF' })], spacing: { after: 0 } })] }),
          ]})],
        }));
        // Company in gray below
        children.push(new Paragraph({ children: [new TextRun({ text: exp.company, size: 16, color: '6B7280' })], spacing: { after: 50 } }));
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            if (line.trim()) children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20, color: '4B5563' })], spacing: { after: 40 } }));
          }
        }
        children.push(new Paragraph({ text: '', spacing: { after: 100 } }));
      }
    }

    // ── Education: degree/date row + school below ─────────────────────────
    if (cvData.education.length > 0) {
      children.push(ncHeading(t.cv.education));
      for (const edu of cvData.education) {
        if (edu.startDate || edu.endDate) {
          children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [new TableRow({ children: [
              new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ children: [new TextRun({ text: edu.degree, bold: true, size: 20, color: '111827' })], spacing: { after: 0 } })] }),
              new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `${edu.startDate} – ${edu.endDate}`, size: 16, color: '9CA3AF' })], spacing: { after: 0 } })] }),
            ]})],
          }));
        } else {
          children.push(new Paragraph({ children: [new TextRun({ text: edu.degree, bold: true, size: 20, color: '111827' })], spacing: { after: 0 } }));
        }
        children.push(new Paragraph({ children: [new TextRun({ text: edu.school, size: 16, color: '6B7280' })], spacing: { after: edu.description ? 40 : 100 } }));
        if (edu.description) children.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 20, color: '4B5563' })], spacing: { after: 100 } }));
      }
    }

    // ── 2-column grid: Skills | Languages ─────────────────────────────────
    const ncLocalizedSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
    const ncHasSkills = ncLocalizedSkills.length > 0;
    const ncHasLangs = cvData.languages.length > 0;
    if (ncHasSkills || ncHasLangs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ncSkillsCol: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ncLangsCol: any[] = [];

      if (ncHasSkills) {
        ncSkillsCol.push(ncHeading(t.cv.skills));
        // Pill-style: bullet-separated tags (closest DOCX approximation)
        ncSkillsCol.push(new Paragraph({
          children: ncLocalizedSkills.map((s, i) => new TextRun({ text: (i > 0 ? '  •  ' : '') + s, size: 18, color: '0F766E' })),
          spacing: { after: 80 },
        }));
      }
      if (ncHasLangs) {
        ncLangsCol.push(ncHeading(t.cv.languages));
        for (const lang of cvData.languages) {
          // Match PDF format: "English / Advanced" — name then / level in gray
          ncLangsCol.push(new Paragraph({
            children: [
              new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), size: 18, color: '374151' }),
              new TextRun({ text: ` / ${lang.level}`, size: 18, color: '9CA3AF' }),
            ],
            spacing: { after: 40 },
          }));
        }
      }

      if (cvData.certifications.length > 0) {
        // certifications go in skills column below skills
        ncSkillsCol.push(ncHeading(t.cv.certifications));
        for (const cert of cvData.certifications) {
          ncSkillsCol.push(new Paragraph({ children: [new TextRun({ text: '• ' + cert, size: 18, color: '374151' })], spacing: { after: 40 } }));
        }
      }

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 280 }, children: ncSkillsCol.length ? ncSkillsCol : [new Paragraph({ text: '' })] }),
          new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: ncLangsCol.length ? ncLangsCol : [new Paragraph({ text: '' })] }),
        ]})],
      }));
    } else if (cvData.certifications.length > 0) {
      children.push(ncHeading(t.cv.certifications));
      for (const cert of cvData.certifications) {
        children.push(new Paragraph({ children: [new TextRun({ text: '• ' + cert, size: 18, color: '374151' })], spacing: { after: 40 } }));
      }
    }
  }

  // ════ LAYOUT: executive-premium (dedicated) ══════════════════════════════════════════════════
  // Matches the HTML template exactly:
  //   • Full-width navy (#111827) header, photo portrait 3:4 centered if present,
  //     name UPPERCASE centered white, thin amber divider, job title gold, contacts gray
  //   • Body: italic centered summary, UPPERCASE tracked section headings (gray),
  //     amber company meta, education centered, skills + languages in 2-column grid
  else if (cfg.customLayout === 'executive-premium') {
    const navyBg = { fill: cfg.headerBg, type: ShadingType.SOLID, color: cfg.headerBg };

    // ── Build header cell content (all centered, dark background) ───────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const epHeaderRows: any[] = [];

    // Photo row (if present)
    if (photoBytes) {
      epHeaderRows.push(new TableRow({
        children: [new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          shading: navyBg,
          margins: { top: 280, bottom: 0, left: 280, right: 280 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 80 } })],
        })],
      }));
    }

    // Name row
    epHeaderRows.push(new TableRow({
      children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        shading: navyBg,
        margins: photoBytes ? { top: 0, bottom: 0, left: 280, right: 280 } : { top: 280, bottom: 0, left: 280, right: 280 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (cvData.personal.fullName || 'YOUR NAME').toUpperCase(), size: 56, color: 'FFFFFF', font: 'Georgia' })], spacing: { after: 40 } })],
      })],
    }));

    // Amber divider row
    epHeaderRows.push(new TableRow({
      children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        shading: navyBg,
        margins: { top: 0, bottom: 0, left: 280, right: 280 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '─────────────────────', size: 18, color: 'D97706' })], spacing: { after: 40 } })],
      })],
    }));

    // Job title row (amber/gold)
    epHeaderRows.push(new TableRow({
      children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        shading: navyBg,
        margins: { top: 0, bottom: 0, left: 280, right: 280 },
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cvData.personal.jobTitle || '', size: 22, color: 'FCD34D', font: 'Georgia' })], spacing: { after: 60 } })],
      })],
    }));

    // Contacts row (gray)
    if (contacts.length > 0) {
      epHeaderRows.push(new TableRow({
        children: [new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          shading: navyBg,
          margins: { top: 0, bottom: 280, left: 280, right: 280 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: contacts.map((c, i) => new TextRun({ text: (i > 0 ? '   |   ' : '') + c, size: 18, color: '9CA3AF', font: 'Georgia' })), spacing: { after: 0 } })],
        })],
      }));
    }

    if (cvData.personal.fathersName) {
      epHeaderRows.push(new TableRow({
        children: [new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          shading: navyBg,
          margins: { top: 0, bottom: 280, left: 280, right: 280 },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: '9CA3AF' }), new TextRun({ text: cvData.personal.fathersName, size: 18, color: '9CA3AF' })], spacing: { after: 0 } })],
        })],
      }));
    }

    // Push full-width navy header table
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: epHeaderRows,
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));

    // ── Section heading helper: gray, UPPERCASE, tracked, centered, bottom border ─
    function epHeading(text: string) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 18, color: '9CA3AF', font: 'Georgia' })],
        spacing: { before: 240, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } },
      });
    }

    // ── Summary: centered italic ───────────────────────────────────────────
    if (cvData.summary) {
      children.push(epHeading(t.cv.summary));
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: cvData.summary, size: 22, color: '374151', italics: true, font: 'Georgia' })],
        spacing: { after: 200 },
      }));
    }

    // ── Experience: position bold, amber company|date, description ──────────
    if (cvData.experience.length > 0) {
      children.push(epHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} – ${exp.isPresent ? t.cv.present : exp.endDate}`;
        // Position title left, date right
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ children: [new TextRun({ text: exp.position, bold: true, size: 22, color: '111827', font: 'Georgia' })], spacing: { after: 0 } })] }),
            new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF', italics: true })], spacing: { after: 0 } })] }),
          ]})],
        }));
        // Company in amber below
        children.push(new Paragraph({ children: [new TextRun({ text: exp.company, size: 18, color: 'B45309' })], spacing: { after: 50 } }));
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            if (line.trim()) children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20, color: '374151' })], spacing: { after: 40 } }));
          }
        }
        children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      }
    }

    // ── Education: centered degree + school ───────────────────────────────
    if (cvData.education.length > 0) {
      children.push(epHeading(t.cv.education));
      for (const edu of cvData.education) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827', font: 'Georgia' })], spacing: { after: 20 } }));
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: edu.school, size: 18, color: '6B7280' })], spacing: { after: edu.description ? 30 : 80 } }));
        if (edu.description) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: edu.description, size: 18, color: '4B5563' })], spacing: { after: 80 } }));
      }
    }

    // ── Skills + Languages: side-by-side 2-column (centered) ──────────────
    const epLocalizedSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
    const epHasSkills = epLocalizedSkills.length > 0;
    const epHasLangs = cvData.languages.length > 0;
    if (epHasSkills || epHasLangs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const epSkillsCol: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const epLangsCol: any[] = [];

      function epColHeading(text: string) {
        return new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 16, color: '9CA3AF', font: 'Georgia' })],
          spacing: { before: 160, after: 80 },
        });
      }

      if (epHasSkills) {
        epSkillsCol.push(epColHeading(t.cv.skills));
        for (const s of epLocalizedSkills) {
          epSkillsCol.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s, size: 18, color: '374151' })], spacing: { after: 40 } }));
        }
      }
      if (epHasLangs) {
        epLangsCol.push(epColHeading(t.cv.languages));
        for (const lang of cvData.languages) {
          epLangsCol.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 18, color: '111827' }), new TextRun({ text: `  –  ${lang.level}`, size: 18, color: '6B7280' })], spacing: { after: 40 } }));
        }
      }

      children.push(new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } }, text: '', spacing: { before: 120, after: 0 } }));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 140 }, children: epSkillsCol.length ? epSkillsCol : [new Paragraph({ text: '' })] }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 140, right: 0 }, children: epLangsCol.length ? epLangsCol : [new Paragraph({ text: '' })] }),
        ]})],
      }));
    }

    // ── Certifications ───────────────────────────────────────────────────
    if (cvData.certifications.length > 0) {
      children.push(epHeading(t.cv.certifications));
      for (const cert of cvData.certifications) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cert, size: 20, color: '374151' })], spacing: { after: 60 } }));
      }
    }
  }

  // ════ LAYOUT: single ═══════════════════════════════════════════════════════════════════════════
  else if (cfg.layout === 'single') {
    const hAlign = cfg.headerAlignment === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT;
    if (photoBytes) {
      // FIX-01: photo side; FIX-02: header alignment
      const photoLeft = cfg.photoSide === 'left';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const infoLines: any[] = [
        new Paragraph({ alignment: hAlign, children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 44, color: '111827' })], spacing: { after: 40 } }),
        new Paragraph({ alignment: hAlign, children: [new TextRun({ text: cvData.personal.jobTitle || '', size: 24, color: cfg.titleColor })], spacing: { after: 60 } }),
      ];
      if (contacts.length > 0) infoLines.push(new Paragraph({ alignment: hAlign, children: [new TextRun({ text: contacts.join('  |  '), size: 18, color: '6B7280' })], spacing: { after: 0 } }));
      if (cvData.personal.fathersName) infoLines.push(new Paragraph({ alignment: hAlign, children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: '6B7280' }), new TextRun({ text: cvData.personal.fathersName, size: 18, color: '6B7280' })], spacing: { after: 0 } }));
      const photoCell = new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, children: [new Paragraph({ alignment: photoLeft ? AlignmentType.LEFT : AlignmentType.RIGHT, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 0 } })] });
      const infoCell = new TableCell({ width: { size: 80, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, children: infoLines });
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: photoLeft ? [photoCell, infoCell] : [infoCell, photoCell] })],
        borders: noBorders,
      }));
    } else {
      children.push(new Paragraph({ alignment: hAlign, children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 44, color: '111827' })], spacing: { after: 60 } }));
      if (cvData.personal.jobTitle) children.push(new Paragraph({ alignment: hAlign, children: [new TextRun({ text: cvData.personal.jobTitle, size: 24, color: cfg.titleColor })], spacing: { after: 60 } }));
      if (contacts.length > 0) children.push(new Paragraph({ alignment: hAlign, children: [new TextRun({ text: contacts.join('  |  '), size: 18, color: '6B7280' })], spacing: { after: 100 } }));
      if (cvData.personal.fathersName) children.push(new Paragraph({ alignment: hAlign, children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: '6B7280' }), new TextRun({ text: cvData.personal.fathersName, size: 18, color: '6B7280' })], spacing: { after: 60 } }));
    }
    children.push(divider());
    appendContentSections(children);
  }

  // ════ LAYOUT: modern-minimal-executive (dedicated) ═══════════════════════════════════════════
  // Left-aligned header (name / job title / contact line), indigo UPPERCASE section headings
  // with bottom border, work experience as Job Title → Company → Dates (stacked lines),
  // real Word bullets for descriptions, skills as 2-column table, languages Name - Level per line
  else if (cfg.customLayout === 'modern-minimal-executive') {

    // ── Section heading helper ─────────────────────────────────────────────
    function mmeHeading(text: string) {
      return new Paragraph({
        children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, color: cfg.headingColor })],
        spacing: { before: 280, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.headingBorder } },
      });
    }

    // ── Header: name / job title / contact line (left-aligned) ────────────
    if (photoBytes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mmeInfoLines: any[] = [
        new Paragraph({ children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 48, color: '111827' })], spacing: { after: 40 } }),
        new Paragraph({ children: [new TextRun({ text: cvData.personal.jobTitle || '', size: 24, color: cfg.titleColor })], spacing: { after: 60 } }),
      ];
      if (contacts.length > 0) mmeInfoLines.push(new Paragraph({ children: [new TextRun({ text: contacts.join('  |  '), size: 18, color: '6B7280' })], spacing: { after: 0 } }));
      if (cvData.personal.fathersName) mmeInfoLines.push(new Paragraph({ children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: '6B7280' }), new TextRun({ text: cvData.personal.fathersName, size: 18, color: '6B7280' })], spacing: { after: 0 } }));
      const mmePhotoCell = new TableCell({ width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 0 } })] });
      const mmeInfoCell = new TableCell({ width: { size: 80, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, children: mmeInfoLines });
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ children: [mmeInfoCell, mmePhotoCell] })] }));
    } else {
      children.push(new Paragraph({ children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 48, color: '111827' })], spacing: { after: 40 } }));
      if (cvData.personal.jobTitle) children.push(new Paragraph({ children: [new TextRun({ text: cvData.personal.jobTitle, size: 24, color: cfg.titleColor })], spacing: { after: 60 } }));
      if (contacts.length > 0) children.push(new Paragraph({ children: [new TextRun({ text: contacts.join('  |  '), size: 18, color: '6B7280' })], spacing: { after: 80 } }));
      if (cvData.personal.fathersName) children.push(new Paragraph({ children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: '6B7280' }), new TextRun({ text: cvData.personal.fathersName, size: 18, color: '6B7280' })], spacing: { after: 60 } }));
    }

    // Thin divider below header
    children.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } },
      spacing: { before: 80, after: 80 },
    }));

    // ── Professional Summary ───────────────────────────────────────────────
    if (cvData.summary) {
      children.push(mmeHeading(t.cv.summary));
      children.push(new Paragraph({
        children: [new TextRun({ text: cvData.summary, size: 22, color: '374151' })],
        spacing: { after: 120, line: 288, lineRule: 'auto' },
      }));
    }

    // ── Work Experience ────────────────────────────────────────────────────
    if (cvData.experience.length > 0) {
      children.push(mmeHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} – ${exp.isPresent ? t.cv.present : exp.endDate}`;
        // Job Title (bold)
        children.push(new Paragraph({
          children: [new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' })],
          spacing: { after: 20 },
        }));
        // Company (next line, gray)
        children.push(new Paragraph({
          children: [new TextRun({ text: exp.company, size: 20, color: '6B7280' })],
          spacing: { after: 20 },
        }));
        // Dates (next line, smaller gray italic)
        children.push(new Paragraph({
          children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF', italics: true })],
          spacing: { after: 50 },
        }));
        // Description with real Word bullets
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const isBullet = /^[-•*]|^\d+\./.test(trimmed);
            const bulletText = isBullet ? trimmed.replace(/^[-•*]\s*/, '') : trimmed;
            children.push(new Paragraph({
              children: [
                new TextRun({ text: isBullet ? '•  ' : '', size: 22, color: cfg.accent }),
                new TextRun({ text: bulletText, size: 22, color: '374151' }),
              ],
              indent: isBullet ? { left: 220, hanging: 220 } : undefined,
              spacing: { after: 36 },
            }));
          }
        }
        children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      }
    }

    // ── Education ─────────────────────────────────────────────────────────
    if (cvData.education.length > 0) {
      children.push(mmeHeading(t.cv.education));
      for (const edu of cvData.education) {
        // Degree/Title (bold)
        children.push(new Paragraph({
          children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' })],
          spacing: { after: 20 },
        }));
        // Institution (gray)
        children.push(new Paragraph({
          children: [new TextRun({ text: edu.school, size: 20, color: '6B7280' })],
          spacing: { after: 20 },
        }));
        // Dates
        if (edu.startDate || edu.endDate) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `${edu.startDate} – ${edu.endDate}`, size: 18, color: '9CA3AF', italics: true })],
            spacing: { after: 50 },
          }));
        }
        if (edu.description) {
          children.push(new Paragraph({
            children: [new TextRun({ text: edu.description, size: 22, color: '374151' })],
            spacing: { after: 60 },
          }));
        }
        children.push(new Paragraph({ text: '', spacing: { after: 60 } }));
      }
    }

    // ── Skills: 2-column table ─────────────────────────────────────────────
    if (cvData.skills.length > 0) {
      children.push(mmeHeading(t.cv.skills));
      const mmeSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
      const mmeHalf = Math.ceil(mmeSkills.length / 2);
      const mmeCol1 = mmeSkills.slice(0, mmeHalf);
      const mmeCol2 = mmeSkills.slice(mmeHalf);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mmeCol1Children: any[] = mmeCol1.map((sk) => new Paragraph({ children: [new TextRun({ text: '•  ' + sk, size: 22, color: '374151' })], spacing: { after: 40 } }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mmeCol2Children: any[] = mmeCol2.map((sk) => new Paragraph({ children: [new TextRun({ text: '•  ' + sk, size: 22, color: '374151' })], spacing: { after: 40 } }));
      if (mmeCol1Children.length === 0) mmeCol1Children.push(new Paragraph({ text: '' }));
      if (mmeCol2Children.length === 0) mmeCol2Children.push(new Paragraph({ text: '' }));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 160 }, children: mmeCol1Children }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 160, right: 0 }, children: mmeCol2Children }),
        ]})],
      }));
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    }

    // ── Languages: Name - Level, one per line ─────────────────────────────
    if (cvData.languages.length > 0) {
      children.push(mmeHeading(t.cv.languages));
      for (const lang of cvData.languages) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 22, color: '111827' }),
            new TextRun({ text: ' - ' + lang.level, size: 22, color: '6B7280' }),
          ],
          spacing: { after: 50 },
        }));
      }
    }

    // ── Certifications ────────────────────────────────────────────────────
    if (cvData.certifications.length > 0) {
      children.push(mmeHeading(t.cv.certifications));
      for (const cert of cvData.certifications) {
        children.push(new Paragraph({
          children: [new TextRun({ text: '•  ', size: 22, color: cfg.accent }), new TextRun({ text: cert, size: 22, color: '374151' })],
          spacing: { after: 60 },
        }));
      }
    }
  }

  // ════ LAYOUT: corporate-navy (dedicated) ═════════════════════════════════════════════════════
  // Centered dark header · letter-spaced section headings · 2-col skills · slash languages
  else if (cfg.customLayout === 'corporate-navy') {
    const cnBg = { fill: cfg.headerBg, type: ShadingType.SOLID, color: cfg.headerBg };

    // ── Helper: simulate letter-spacing by inserting spaces between chars ──
    function spaced(text: string): string {
      return text.toUpperCase().split('').join(' ');
    }

    // ── Section heading with simulated tracking ────────────────────────────
    function cnHeading(text: string) {
      return new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: spaced(text), bold: true, size: 17, color: cfg.headingColor })],
        spacing: { before: 260, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.headingBorder } },
      });
    }

    // ── Date row helper: left content / right italic date ──────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function cnDateRow(leftRuns: any[], dateText: string) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 73, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ children: leftRuns, spacing: { after: 20 } })] }),
          new TableCell({ width: { size: 27, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF', italics: true })], spacing: { after: 20 } })] }),
        ]})],
      });
    }

    // ── Header: centered dark bg ────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cnHeaderChildren: any[] = [];

    if (photoBytes) {
      cnHeaderChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 100 } }));
    }
    cnHeaderChildren.push(
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 52, color: 'FFFFFF' })], spacing: { after: 40 } }),
    );
    if (cvData.personal.jobTitle) {
      cnHeaderChildren.push(
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cvData.personal.jobTitle, size: 22, color: '94A3B8' })], spacing: { after: 50 } }),
      );
    }
    // Contact line: email | phone (centered, single line)
    const cnContacts: string[] = [];
    if (cvData.personal.email) cnContacts.push(cvData.personal.email);
    if (cvData.personal.phone) cnContacts.push(cvData.personal.phone);
    if (rs.showAddress && cvData.personal.address) cnContacts.push(cvData.personal.address);
    if (cvData.personal.dateOfBirth) cnContacts.push(cvData.personal.dateOfBirth);
    if (cvData.personal.nationality) cnContacts.push(cvData.personal.nationality);
    if (cnContacts.length > 0) {
      cnHeaderChildren.push(
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cnContacts.join('  |  '), size: 18, color: '94A3B8' })], spacing: { after: 0 } }),
      );
    }
    if (cvData.personal.fathersName) {
      cnHeaderChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: '94A3B8' }), new TextRun({ text: cvData.personal.fathersName, size: 18, color: '94A3B8' })], spacing: { after: 0 } }));
    }

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [new TableRow({ children: [new TableCell({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, shading: cnBg, margins: { top: 300, bottom: 300, left: 360, right: 360 }, children: cnHeaderChildren })] })],
    }));

    // Blue accent bar below header
    const cnAccentBg = { fill: cfg.accent, type: ShadingType.SOLID, color: cfg.accent };
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [new TableRow({ children: [new TableCell({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, shading: cnAccentBg, margins: { top: 55, bottom: 55, left: 0, right: 0 }, children: [new Paragraph({ text: '' })] })] })],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));

    // ── Professional Summary ───────────────────────────────────────────────
    if (cvData.summary) {
      children.push(cnHeading(t.cv.summary));
      children.push(new Paragraph({
        children: [new TextRun({ text: cvData.summary, size: 22, color: '374151' })],
        spacing: { after: 140, line: 276, lineRule: 'auto' },
      }));
    }

    // ── Work Experience ────────────────────────────────────────────────────
    if (cvData.experience.length > 0) {
      children.push(cnHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} – ${exp.isPresent ? t.cv.present : exp.endDate}`;
        // Position (bold) left | date right
        children.push(cnDateRow([
          new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' }),
        ], dateText));
        // Company on its own line in gray
        children.push(new Paragraph({ children: [new TextRun({ text: exp.company, size: 20, color: '6B7280' })], spacing: { after: 50 } }));
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            // Detect bullet lines (starting with -, •, *, or numbers)
            const isBullet = /^[-•*]|^\d+\./.test(trimmed);
            const bulletText = isBullet ? trimmed.replace(/^[-•*]\s*/, '') : trimmed;
            children.push(new Paragraph({
              children: [
                new TextRun({ text: isBullet ? '•  ' : '', size: 22, color: cfg.accent }),
                new TextRun({ text: bulletText, size: 22, color: '374151' }),
              ],
              indent: isBullet ? { left: 200, hanging: 200 } : undefined,
              spacing: { after: 36 },
            }));
          }
        }
        children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      }
    }

    // ── Education ─────────────────────────────────────────────────────────
    if (cvData.education.length > 0) {
      children.push(cnHeading(t.cv.education));
      for (const edu of cvData.education) {
        const dateText = edu.startDate || edu.endDate ? `${edu.startDate} – ${edu.endDate}` : '';
        if (dateText) {
          children.push(cnDateRow([
            new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' }),
          ], dateText));
        } else {
          children.push(new Paragraph({ children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' })], spacing: { after: 20 } }));
        }
        children.push(new Paragraph({ children: [new TextRun({ text: edu.school, size: 20, color: '6B7280' })], spacing: { after: edu.description ? 40 : 80 } }));
        if (edu.description) children.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 22, color: '374151' })], spacing: { after: 80 } }));
      }
    }

    // ── Skills: 2-column table ─────────────────────────────────────────────
    if (cvData.skills.length > 0) {
      children.push(cnHeading(t.cv.skills));
      const cnSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
      const half = Math.ceil(cnSkills.length / 2);
      const col1 = cnSkills.slice(0, half);
      const col2 = cnSkills.slice(half);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const col1Children: any[] = col1.map((sk) => new Paragraph({ children: [new TextRun({ text: '•  ' + sk, size: 22, color: '374151' })], spacing: { after: 36 } }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const col2Children: any[] = col2.map((sk) => new Paragraph({ children: [new TextRun({ text: '•  ' + sk, size: 22, color: '374151' })], spacing: { after: 36 } }));
      if (col1Children.length === 0) col1Children.push(new Paragraph({ text: '' }));
      if (col2Children.length === 0) col2Children.push(new Paragraph({ text: '' }));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 160 }, children: col1Children }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 160, right: 0 }, children: col2Children }),
        ]})],
      }));
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    }

    // ── Languages: Name / Level, one per line ─────────────────────────────
    if (cvData.languages.length > 0) {
      children.push(cnHeading(t.cv.languages));
      for (const lang of cvData.languages) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 22, color: '111827' }),
            new TextRun({ text: ' / ' + lang.level, size: 22, color: '6B7280' }),
          ],
          spacing: { after: 50 },
        }));
      }
    }

    // ── Certifications ────────────────────────────────────────────────────
    if (cvData.certifications.length > 0) {
      children.push(cnHeading(t.cv.certifications));
      for (const cert of cvData.certifications) {
        children.push(new Paragraph({ children: [new TextRun({ text: '•  ', size: 22, color: cfg.accent }), new TextRun({ text: cert, size: 22, color: '374151' })], spacing: { after: 60 } }));
      }
    }
  }

  // ════ LAYOUT: contemporary-bold (dedicated) ══════════════════════════════════════════════════
  // Strong bold identity: left-aligned dark navy header, blue accent bar, letter-spaced section
  // headings (simulated tracking), stacked job title / company / dates structure, 2-col skills,
  // slash languages (Name / Level), real Word bullets for descriptions.
  else if (cfg.customLayout === 'contemporary-bold') {
    const cbBg = { fill: cfg.headerBg, type: ShadingType.SOLID, color: cfg.headerBg };

    // ── Helper: simulate letter-spacing by inserting spaces between chars ──
    function cbSpaced(text: string): string {
      return text.toUpperCase().split('').join(' ');
    }

    // ── Section heading: navy, UPPERCASE with tracking, bold, bottom border ─
    function cbHeading(text: string) {
      return new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: cbSpaced(text), bold: true, size: 18, color: cfg.headingColor })],
        spacing: { before: 280, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.headingBorder } },
      });
    }

    // ── Header: left-aligned on dark navy background ────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cbHeaderChildren: any[] = [];

    cbHeaderChildren.push(
      new Paragraph({
        children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 52, color: 'FFFFFF' })],
        spacing: { after: 40 },
      }),
    );
    if (cvData.personal.jobTitle) {
      cbHeaderChildren.push(
        new Paragraph({
          children: [new TextRun({ text: cvData.personal.jobTitle, size: 22, color: '94A3B8' })],
          spacing: { after: 60 },
        }),
      );
    }
    // Contact line: email | phone
    const cbContacts: string[] = [];
    if (cvData.personal.email) cbContacts.push(cvData.personal.email);
    if (cvData.personal.phone) cbContacts.push(cvData.personal.phone);
    if (rs.showAddress && cvData.personal.address) cbContacts.push(cvData.personal.address);
    if (cvData.personal.dateOfBirth) cbContacts.push(cvData.personal.dateOfBirth);
    if (cvData.personal.nationality) cbContacts.push(cvData.personal.nationality);
    if (cbContacts.length > 0) {
      cbHeaderChildren.push(
        new Paragraph({
          children: [new TextRun({ text: cbContacts.join('  |  '), size: 18, color: '94A3B8' })],
          spacing: { after: 0 },
        }),
      );
    }
    if (cvData.personal.fathersName) {
      cbHeaderChildren.push(new Paragraph({
        children: [
          new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: '94A3B8' }),
          new TextRun({ text: cvData.personal.fathersName, size: 18, color: '94A3B8' }),
        ],
        spacing: { after: 0 },
      }));
    }

    if (photoBytes) {
      const cbPhotoCell = new TableCell({
        width: { size: 18, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
        borders: noBorders, shading: cbBg,
        margins: { top: 260, bottom: 260, left: 280, right: 160 },
        children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 0 } })],
      });
      const cbInfoCell = new TableCell({
        width: { size: 82, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER,
        borders: noBorders, shading: cbBg,
        margins: { top: 260, bottom: 260, left: 160, right: 280 },
        children: cbHeaderChildren,
      });
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ children: [cbPhotoCell, cbInfoCell] })] }));
    } else {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders,
        rows: [new TableRow({ children: [new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, shading: cbBg,
          margins: { top: 260, bottom: 260, left: 300, right: 300 },
          children: cbHeaderChildren,
        })] })],
      }));
    }

    // Blue accent bar below header
    const cbAccentBg = { fill: cfg.accent, type: ShadingType.SOLID, color: cfg.accent };
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders,
      rows: [new TableRow({ children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, shading: cbAccentBg,
        margins: { top: 55, bottom: 55, left: 0, right: 0 },
        children: [new Paragraph({ text: '' })],
      })] })],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));

    // ── Professional Summary ─────────────────────────────────────────────────
    if (cvData.summary) {
      children.push(cbHeading(t.cv.summary));
      children.push(new Paragraph({
        children: [new TextRun({ text: cvData.summary, size: 22, color: '374151' })],
        spacing: { after: 140, line: 276, lineRule: 'auto' },
      }));
    }

    // ── Work Experience: Job Title (bold) / Company / Dates (stacked) ────────
    if (cvData.experience.length > 0) {
      children.push(cbHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} – ${exp.isPresent ? t.cv.present : exp.endDate}`;
        // Job Title — bold, dominant
        children.push(new Paragraph({
          children: [new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' })],
          spacing: { after: 20 },
        }));
        // Company — next line, gray
        children.push(new Paragraph({
          children: [new TextRun({ text: exp.company, size: 20, color: '6B7280' })],
          spacing: { after: 20 },
        }));
        // Dates — next line, small gray italic
        children.push(new Paragraph({
          children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF', italics: true })],
          spacing: { after: 50 },
        }));
        // Description — real Word bullets
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const isBullet = /^[-•*]|^\d+\./.test(trimmed);
            const bulletText = isBullet ? trimmed.replace(/^[-•*]\s*/, '') : trimmed;
            children.push(new Paragraph({
              children: [
                new TextRun({ text: isBullet ? '•  ' : '', size: 22, color: cfg.accent }),
                new TextRun({ text: bulletText, size: 22, color: '374151' }),
              ],
              indent: isBullet ? { left: 220, hanging: 220 } : undefined,
              spacing: { after: 36 },
            }));
          }
        }
        children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      }
    }

    // ── Education: Degree / Institution / Dates (stacked) ──────────────────
    if (cvData.education.length > 0) {
      children.push(cbHeading(t.cv.education));
      for (const edu of cvData.education) {
        // Degree / Title — bold
        children.push(new Paragraph({
          children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' })],
          spacing: { after: 20 },
        }));
        // Institution — gray
        children.push(new Paragraph({
          children: [new TextRun({ text: edu.school, size: 20, color: '6B7280' })],
          spacing: { after: 20 },
        }));
        // Dates — small gray italic
        if (edu.startDate || edu.endDate) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `${edu.startDate} – ${edu.endDate}`, size: 18, color: '9CA3AF', italics: true })],
            spacing: { after: 50 },
          }));
        }
        if (edu.description) {
          children.push(new Paragraph({
            children: [new TextRun({ text: edu.description, size: 22, color: '374151' })],
            spacing: { after: 60 },
          }));
        }
        children.push(new Paragraph({ text: '', spacing: { after: 60 } }));
      }
    }

    // ── Skills: 2-column table with bullet points ────────────────────────────
    if (cvData.skills.length > 0) {
      children.push(cbHeading(t.cv.skills));
      const cbSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
      const cbHalf = Math.ceil(cbSkills.length / 2);
      const cbCol1 = cbSkills.slice(0, cbHalf);
      const cbCol2 = cbSkills.slice(cbHalf);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cbCol1Children: any[] = cbCol1.map((sk) => new Paragraph({ children: [new TextRun({ text: '•  ' + sk, size: 22, color: '374151' })], spacing: { after: 36 } }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cbCol2Children: any[] = cbCol2.map((sk) => new Paragraph({ children: [new TextRun({ text: '•  ' + sk, size: 22, color: '374151' })], spacing: { after: 36 } }));
      if (cbCol1Children.length === 0) cbCol1Children.push(new Paragraph({ text: '' }));
      if (cbCol2Children.length === 0) cbCol2Children.push(new Paragraph({ text: '' }));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 160 }, children: cbCol1Children }),
          new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 160, right: 0 }, children: cbCol2Children }),
        ]})],
      }));
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    }

    // ── Languages: Name / Level, one per line ────────────────────────────────
    if (cvData.languages.length > 0) {
      children.push(cbHeading(t.cv.languages));
      for (const lang of cvData.languages) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 22, color: '111827' }),
            new TextRun({ text: ' / ' + lang.level, size: 22, color: '6B7280' }),
          ],
          spacing: { after: 50 },
        }));
      }
    }

    // ── Certifications ────────────────────────────────────────────────────────
    if (cvData.certifications.length > 0) {
      children.push(cbHeading(t.cv.certifications));
      for (const cert of cvData.certifications) {
        children.push(new Paragraph({
          children: [new TextRun({ text: '•  ', size: 22, color: cfg.accent }), new TextRun({ text: cert, size: 22, color: '374151' })],
          spacing: { after: 60 },
        }));
      }
    }
  }

  // ════ LAYOUT: dark-header ═══════════════════════════════════════════════════════════════════
  else if (cfg.layout === 'dark-header') {
    const darkBg = { fill: cfg.headerBg, type: ShadingType.SOLID, color: cfg.headerBg };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headerInfoChildren: any[] = [
      new Paragraph({ children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 44, color: cfg.headerText })], spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: cvData.personal.jobTitle || '', size: 22, color: cfg.titleColor })], spacing: { after: 60 } }),
    ];
    if (contacts.length > 0) headerInfoChildren.push(new Paragraph({ children: [new TextRun({ text: contacts.join('  |  '), size: 18, color: cfg.titleColor })], spacing: { after: 40 } }));
    if (cvData.personal.fathersName) headerInfoChildren.push(new Paragraph({ children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: cfg.titleColor }), new TextRun({ text: cvData.personal.fathersName, size: 18, color: cfg.titleColor })], spacing: { after: 0 } }));

    if (photoBytes) {
      // FIX-01: photo side support in dark-header
      const photoLeft = cfg.photoSide === 'left';
      const photoCell = new TableCell({ width: { size: 15, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: noBorders, shading: darkBg, margins: { top: 200, bottom: 200, left: photoLeft ? 280 : 140, right: photoLeft ? 140 : 280 }, children: [new Paragraph({ alignment: photoLeft ? AlignmentType.LEFT : AlignmentType.RIGHT, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 0 } })] });
      const infoCell = new TableCell({ width: { size: 85, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: noBorders, shading: darkBg, margins: { top: 200, bottom: 200, left: photoLeft ? 140 : 280, right: photoLeft ? 280 : 140 }, children: headerInfoChildren });
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: photoLeft ? [photoCell, infoCell] : [infoCell, photoCell] })],
        borders: noBorders,
      }));
    } else {
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: [new TableCell({ width: { size: 100, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: noBorders, shading: darkBg, margins: { top: 200, bottom: 200, left: 280, right: 280 }, children: headerInfoChildren })] })],
        borders: noBorders,
      }));
    }
    // FIX-06: colored accent bar below header for corporate-navy / contemporary-bold
    if (cfg.accentBar) {
      const accentBg = { fill: cfg.accent, type: ShadingType.SOLID, color: cfg.accent };
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: [new TableCell({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, shading: accentBg, margins: { top: 60, bottom: 60, left: 0, right: 0 }, children: [new Paragraph({ text: '' })] })] })],
        borders: noBorders,
      }));
    }
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
    appendContentSections(children);
  }

  // ════ LAYOUT: centered-dark-header ════════════════════════════════════════════════════════
  else if (cfg.layout === 'centered-dark-header') {
    const darkBg = { fill: cfg.headerBg, type: ShadingType.SOLID, color: cfg.headerBg };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headerCenteredChildren: any[] = [];
    if (photoBytes) headerCenteredChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 80 } }));
    headerCenteredChildren.push(
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (cvData.personal.fullName || 'Your Name').toUpperCase(), bold: false, size: 56, color: cfg.headerText })], spacing: { after: 40 } }),
    );
    // FIX-07: amber decorative divider line after name for executive-premium
    if (cfg.amberDivider) {
      headerCenteredChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: '─────────────────────', size: 18, color: cfg.accent })],
        spacing: { after: 30 },
      }));
    }
    headerCenteredChildren.push(
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cvData.personal.jobTitle || '', size: 20, color: cfg.titleColor })], spacing: { after: 60 } }),
    );
    if (contacts.length > 0) headerCenteredChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: contacts.join('  |  '), size: 18, color: cfg.titleColor })], spacing: { after: 0 } }));
    if (cvData.personal.fathersName) headerCenteredChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: cfg.titleColor }), new TextRun({ text: cvData.personal.fathersName, size: 18, color: cfg.titleColor })], spacing: { after: 0 } }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: [new TableCell({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, shading: darkBg, margins: { top: 280, bottom: 280, left: 280, right: 280 }, children: headerCenteredChildren })] })],
      borders: noBorders,
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 160 } }));
    appendContentSections(children, true, true, true);
  }

  // ════ LAYOUT: tech-sidebar (dedicated) ═══════════════════════════════════════════════════════
  // Dark slate-900 sidebar (30%) | white main panel (70%)
  // Photo: square JPEG, centered at top of sidebar
  // Sidebar: name, job title, contacts, skills, languages, certifications (all white/blue text)
  // Main: summary, experience (right-aligned dates), education
  // Bottom of main: nested 2-col table with SKILLS (left) + LANGUAGES (right)
  else if (cfg.customLayout === 'tech-sidebar') {
    const sidebarBg = { fill: cfg.headerBg, type: ShadingType.SOLID, color: cfg.headerBg };
    const sidebarPct = cfg.sidebarPct || 30;
    const mainPct = 100 - sidebarPct;

    // ── LEFT SIDEBAR ──────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sidebarChildren: any[] = [];

    // Photo — square, centered, with rounded visual feel via tight sizing
    if (photoBytes) {
      sidebarChildren.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })],
        spacing: { before: 0, after: 140 },
      }));
    }

    // Name
    sidebarChildren.push(new Paragraph({
      children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 28, color: 'FFFFFF' })],
      spacing: { after: 50 },
    }));

    // Job title
    if (cvData.personal.jobTitle) {
      sidebarChildren.push(new Paragraph({
        children: [new TextRun({ text: cvData.personal.jobTitle, size: 20, color: cfg.accent })],
        spacing: { after: 120 },
      }));
    }

    // Contacts — each on its own line, white
    for (const c of contacts) {
      sidebarChildren.push(new Paragraph({
        children: [new TextRun({ text: c, size: 17, color: 'CBD5E1' })],
        spacing: { after: 40 },
      }));
    }
    if (cvData.personal.fathersName) {
      sidebarChildren.push(new Paragraph({
        children: [
          new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 17, color: 'CBD5E1' }),
          new TextRun({ text: cvData.personal.fathersName, size: 17, color: 'CBD5E1' }),
        ],
        spacing: { after: 40 },
      }));
    }

    // Skills in sidebar
    if (cvData.skills.length > 0) {
      sidebarChildren.push(new Paragraph({
        children: [new TextRun({ text: t.cv.skills.toUpperCase(), bold: true, size: 16, color: cfg.accent })],
        spacing: { before: 160, after: 70 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '334155' } },
      }));
      const localizedSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
      for (const sk of localizedSkills) {
        sidebarChildren.push(new Paragraph({
          children: [new TextRun({ text: '• ' + sk, size: 17, color: 'E2E8F0' })],
          spacing: { after: 36 },
        }));
      }
    }

    // Languages in sidebar
    if (cvData.languages.length > 0) {
      sidebarChildren.push(new Paragraph({
        children: [new TextRun({ text: t.cv.languages.toUpperCase(), bold: true, size: 16, color: cfg.accent })],
        spacing: { before: 160, after: 70 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '334155' } },
      }));
      for (const lang of cvData.languages) {
        sidebarChildren.push(new Paragraph({
          children: [
            new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 17, color: 'E2E8F0' }),
            new TextRun({ text: ' – ' + lang.level, size: 16, color: '94A3B8' }),
          ],
          spacing: { after: 40 },
        }));
      }
    }

    // Certifications in sidebar
    if (cvData.certifications.length > 0) {
      sidebarChildren.push(new Paragraph({
        children: [new TextRun({ text: t.cv.certifications.toUpperCase(), bold: true, size: 16, color: cfg.accent })],
        spacing: { before: 160, after: 70 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '334155' } },
      }));
      for (const cert of cvData.certifications) {
        sidebarChildren.push(new Paragraph({
          children: [new TextRun({ text: '• ' + cert, size: 17, color: 'E2E8F0' })],
          spacing: { after: 36 },
        }));
      }
    }

    // ── RIGHT MAIN PANEL ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mainChildren: any[] = [];

    // Heading helper for main panel
    function techMainHeading(text: string) {
      const label = text.toUpperCase();
      return new Paragraph({
        children: [new TextRun({ text: label, bold: true, size: 18, color: cfg.headingColor })],
        spacing: { before: 200, after: 80 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.headingBorder } },
      });
    }

    // Date row helper for main panel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function techDateRow(leftRuns: any[], dateText: string) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({
            width: { size: 72, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [new Paragraph({ children: leftRuns, spacing: { after: 20 } })],
          }),
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: dateText, size: 18, color: '94A3B8', italics: true })],
              spacing: { after: 20 },
            })],
          }),
        ]})],
      });
    }

    // PROFESSIONAL SUMMARY
    if (cvData.summary) {
      mainChildren.push(techMainHeading(t.cv.summary));
      mainChildren.push(new Paragraph({
        children: [new TextRun({ text: cvData.summary, size: 20, color: '374151' })],
        spacing: { after: 120 },
      }));
    }

    // WORK EXPERIENCE
    if (cvData.experience.length > 0) {
      mainChildren.push(techMainHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} – ${exp.isPresent ? t.cv.present : exp.endDate}`;
        mainChildren.push(techDateRow([
          new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' }),
          new TextRun({ text: '  —  ' + exp.company, size: 20, color: '6B7280' }),
        ], dateText));
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            if (line.trim()) {
              mainChildren.push(new Paragraph({
                children: [new TextRun({ text: line, size: 20, color: '374151' })],
                spacing: { after: 36 },
              }));
            }
          }
        }
        mainChildren.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      }
    }

    // EDUCATION
    if (cvData.education.length > 0) {
      mainChildren.push(techMainHeading(t.cv.education));
      for (const edu of cvData.education) {
        if (edu.startDate || edu.endDate) {
          mainChildren.push(techDateRow([
            new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' }),
            new TextRun({ text: '  —  ' + edu.school, size: 20, color: '6B7280' }),
          ], `${edu.startDate} – ${edu.endDate}`));
        } else {
          mainChildren.push(new Paragraph({
            children: [
              new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' }),
              new TextRun({ text: '  —  ' + edu.school, size: 20, color: '6B7280' }),
            ],
            spacing: { after: 40 },
          }));
        }
        if (edu.description) {
          mainChildren.push(new Paragraph({
            children: [new TextRun({ text: edu.description, size: 20, color: '374151' })],
            spacing: { after: 80 },
          }));
        }
      }
    }

    // ── SKILLS + LANGUAGES: nested 2-column table at the bottom of main panel ──
    const hasSkillsOrLangs = cvData.skills.length > 0 || cvData.languages.length > 0;
    if (hasSkillsOrLangs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skillsCellChildren: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const langsCellChildren: any[] = [];

      if (cvData.skills.length > 0) {
        skillsCellChildren.push(new Paragraph({
          children: [new TextRun({ text: t.cv.skills.toUpperCase(), bold: true, size: 18, color: cfg.headingColor })],
          spacing: { before: 0, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.headingBorder } },
        }));
        const localizedSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
        skillsCellChildren.push(new Paragraph({
          children: [new TextRun({ text: localizedSkills.join('  •  '), size: 20, color: '374151' })],
          spacing: { after: 60 },
        }));
      }

      if (cvData.languages.length > 0) {
        langsCellChildren.push(new Paragraph({
          children: [new TextRun({ text: t.cv.languages.toUpperCase(), bold: true, size: 18, color: cfg.headingColor })],
          spacing: { before: 0, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.headingBorder } },
        }));
        for (const lang of cvData.languages) {
          langsCellChildren.push(new Paragraph({
            children: [
              new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 20, color: '111827' }),
              new TextRun({ text: ' – ' + lang.level, size: 20, color: '6B7280' }),
            ],
            spacing: { after: 50 },
          }));
        }
      }

      // Fill empty cells with a placeholder paragraph so the table renders correctly
      if (skillsCellChildren.length === 0) skillsCellChildren.push(new Paragraph({ text: '' }));
      if (langsCellChildren.length === 0) langsCellChildren.push(new Paragraph({ text: '' }));

      mainChildren.push(new Paragraph({ text: '', spacing: { before: 160, after: 0 } }));
      mainChildren.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 0, bottom: 0, left: 0, right: 140 },
            children: skillsCellChildren,
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 0, bottom: 0, left: 140, right: 0 },
            children: langsCellChildren,
          }),
        ]})],
      }));
    }

    // ── Assemble outer 2-column table ─────────────────────────────────────────
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [new TableRow({ children: [
        new TableCell({
          width: { size: sidebarPct, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.TOP,
          borders: noBorders,
          shading: sidebarBg,
          margins: { top: 240, bottom: 240, left: 220, right: 200 },
          children: sidebarChildren,
        }),
        new TableCell({
          width: { size: mainPct, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.TOP,
          borders: noBorders,
          margins: { top: 200, bottom: 240, left: 240, right: 200 },
          children: mainChildren,
        }),
      ]})],
    }));
  }

  // ════ LAYOUT: sidebar-left ═══════════════════════════════════════════════════════════════════
  else {
    const sidebarBg = { fill: cfg.headerBg, type: ShadingType.SOLID, color: cfg.headerBg };
    const sidebarPct = cfg.sidebarPct || 33;
    const mainPct = 100 - sidebarPct;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sidebarChildren: any[] = [];
    if (photoBytes) sidebarChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 120 } }));
    sidebarChildren.push(
      new Paragraph({ children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 26, color: cfg.headerText })], spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: cvData.personal.jobTitle || '', size: 19, color: cfg.titleColor })], spacing: { after: 100 } }),
    );
    for (const c of contacts) sidebarChildren.push(new Paragraph({ children: [new TextRun({ text: c, size: 17, color: cfg.titleColor })], spacing: { after: 40 } }));
    if (cvData.personal.fathersName) sidebarChildren.push(new Paragraph({ children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 17, color: cfg.titleColor }), new TextRun({ text: cvData.personal.fathersName, size: 17, color: cfg.titleColor })], spacing: { after: 40 } }));
    if (cvData.skills.length > 0) {
      sidebarChildren.push(sidebarSectionHeading(t.cv.skills));
      const localizedSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
      for (const sk of localizedSkills) sidebarChildren.push(new Paragraph({ children: [new TextRun({ text: sk, size: 17, color: cfg.headerText })], spacing: { after: 40 } }));
    }
    if (cvData.languages.length > 0) {
      sidebarChildren.push(sidebarSectionHeading(t.cv.languages));
      for (const lang of cvData.languages) sidebarChildren.push(new Paragraph({ children: [new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 17, color: cfg.headerText }), new TextRun({ text: `  ${lang.level}`, size: 16, color: cfg.titleColor })], spacing: { after: 40 } }));
    }
    if (cvData.certifications.length > 0) {
      sidebarChildren.push(sidebarSectionHeading(t.cv.certifications));
      for (const cert of cvData.certifications) sidebarChildren.push(new Paragraph({ children: [new TextRun({ text: '• ' + cert, size: 17, color: cfg.headerText })], spacing: { after: 40 } }));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mainChildren: any[] = [];
    const sidebarNoBorders = noBorders;
    function mainHeading(text: string) {
      const label = cfg.uppercaseHeadings !== false ? text.toUpperCase() : text;
      const borderConfig = cfg.showHeadingBorder !== false
        ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.headingBorder } }
        : {};
      return new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 17, color: cfg.headingColor })], spacing: { before: 0, after: 80 }, border: borderConfig });
    }
    // FIX-08: right-aligned date row for sidebar main panel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function mainDateRow(leftChildren: any[], dateText: string) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: sidebarNoBorders,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: sidebarNoBorders, children: [new Paragraph({ children: leftChildren, spacing: { after: 20 } })] }),
          new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: sidebarNoBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF', italics: true })], spacing: { after: 20 } })] }),
        ]})],
      });
    }
    const rightDates = cfg.rightAlignDates === true;
    if (cvData.summary) {
      mainChildren.push(mainHeading(t.cv.summary));
      mainChildren.push(new Paragraph({ children: [new TextRun({ text: cvData.summary, size: 20, color: '374151' })], spacing: { after: 120 } }));
    }
    if (cvData.experience.length > 0) {
      mainChildren.push(mainHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} – ${exp.isPresent ? t.cv.present : exp.endDate}`;
        if (rightDates) {
          mainChildren.push(mainDateRow([
            new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' }),
            new TextRun({ text: '  —  ' + exp.company, size: 20, color: '6B7280' }),
          ], dateText));
        } else {
          mainChildren.push(new Paragraph({ children: [new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' }), new TextRun({ text: '  —  ' + exp.company, size: 20, color: '6B7280' })], spacing: { after: 40 } }));
          mainChildren.push(new Paragraph({ children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF', italics: true })], spacing: { after: 60 } }));
        }
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            if (line.trim()) mainChildren.push(new Paragraph({ children: [new TextRun({ text: line, size: 20, color: '374151' })], spacing: { after: 40 } }));
          }
        }
        mainChildren.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      }
    }
    if (cvData.education.length > 0) {
      mainChildren.push(mainHeading(t.cv.education));
      for (const edu of cvData.education) {
        if (rightDates && (edu.startDate || edu.endDate)) {
          mainChildren.push(mainDateRow([
            new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' }),
            new TextRun({ text: '  —  ' + edu.school, size: 20, color: '6B7280' }),
          ], `${edu.startDate} – ${edu.endDate}`));
        } else {
          mainChildren.push(new Paragraph({ children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' }), new TextRun({ text: '  —  ' + edu.school, size: 20, color: '6B7280' })], spacing: { after: 40 } }));
          if (edu.startDate || edu.endDate) mainChildren.push(new Paragraph({ children: [new TextRun({ text: `${edu.startDate} – ${edu.endDate}`, size: 18, color: '9CA3AF', italics: true })], spacing: { after: 60 } }));
        }
        if (edu.description) mainChildren.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 20, color: '374151' })], spacing: { after: 80 } }));
      }
    }

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: sidebarPct, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, shading: sidebarBg, margins: { top: 240, bottom: 240, left: 240, right: 200 }, children: sidebarChildren }),
        new TableCell({ width: { size: mainPct, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 240, bottom: 240, left: 200, right: 240 }, children: mainChildren }),
      ]})],
      borders: noBorders,
    }));
  }

  // ── Build and download document ──────────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: cfg.font, size: 22, color: '1F2937' },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  await saveFileViaPlatform(blob, `${fileName}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

// ─── Rirekisho (Japanese CV) DOCX Export ─────────────────────────────────────

export async function exportRirekishoToDOCX(cvData: CVData, fileName: string): Promise<void> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    AlignmentType,
    ImageRun,
    BorderStyle,
    TableRow,
    TableCell,
    Table,
    WidthType,
    VerticalAlign,
    ShadingType,
  } = await import('docx');

  function dataUrlToBytes(dataUrl: string): Uint8Array {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // Smart portrait crop for 3:4 aspect ratio Rirekisho photo.
  function smartCropDataUrl(dataUrl: string, outW: number, outH: number): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        const isPortrait = img.naturalHeight > img.naturalWidth;
        const scaleW = outW / img.naturalWidth;
        const scaleH = outH / img.naturalHeight;
        const scale = Math.max(scaleW, scaleH);
        const scaledW = img.naturalWidth * scale;
        const scaledH = img.naturalHeight * scale;
        const sx = (outW - scaledW) / 2;
        const sy = isPortrait ? -(scaledH - outH) * 0.20 : (outH - scaledH) / 2;
        ctx.drawImage(img, sx, sy, scaledW, scaledH);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  // ── Border definitions ────────────────────────────────────────────────────
  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  };

  const thinBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
    right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  };

  const headerBg = { fill: 'E5E7EB', type: ShadingType.SOLID, color: 'E5E7EB' };
  const sectionBg = { fill: '1F2937', type: ShadingType.SOLID, color: '1F2937' };

  // FIX-12: MS Mincho east-Asia font wrapper
  function jpRun(text: string, opts: Record<string, unknown> = {}) {
    return new TextRun({ text, font: { eastAsia: 'MS Mincho' }, ...opts });
  }

  // Empty paragraph (spacer inside cells / between tables)
  function spacer(pts = 60) {
    return new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: pts } });
  }

  // ── Label cell (gray bg, left-aligned) ───────────────────────────────────
  function labelCell(text: string, widthPct: number, colSpan?: number) {
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: thinBorder,
      shading: headerBg,
      verticalAlign: VerticalAlign.CENTER,
      ...(colSpan ? { columnSpan: colSpan } : {}),
      children: [
        new Paragraph({
          children: [jpRun(text, { bold: true, size: 18, color: '374151' })],
          spacing: { before: 40, after: 40 },
        }),
      ],
    });
  }

  // ── Value cell (white bg) ─────────────────────────────────────────────────
  function valueCell(text: string, widthPct: number, colSpan?: number) {
    return new TableCell({
      width: { size: widthPct, type: WidthType.PERCENTAGE },
      borders: thinBorder,
      verticalAlign: VerticalAlign.CENTER,
      ...(colSpan ? { columnSpan: colSpan } : {}),
      children: [
        new Paragraph({
          children: [jpRun(text || '　', { size: 20, bold: !!text })],
          spacing: { before: 40, after: 40 },
        }),
      ],
    });
  }

  // ── Section heading row (full-width dark bar) ─────────────────────────────
  function sectionHeadingRow(kanji: string) {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: thinBorder,
              shading: sectionBg,
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [jpRun(kanji, { bold: true, size: 24, color: 'FFFFFF' })],
                  spacing: { before: 60, after: 60 },
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  // ── Content table row (期間 | details) ───────────────────────────────────
  function tableHeaderRow(col1: string, col2: string) {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          borders: thinBorder,
          shading: headerBg,
          children: [new Paragraph({ children: [jpRun(col1, { bold: true, size: 18, color: '374151' })], spacing: { before: 40, after: 40 } })],
        }),
        new TableCell({
          width: { size: 72, type: WidthType.PERCENTAGE },
          borders: thinBorder,
          shading: headerBg,
          children: [new Paragraph({ children: [jpRun(col2, { bold: true, size: 18, color: '374151' })], spacing: { before: 40, after: 40 } })],
        }),
      ],
    });
  }

  // ── Document children array ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = [];

  // ── 1. TITLE ROW ─────────────────────────────────────────────────────────
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 8, color: '111827' },
                bottom: { style: BorderStyle.SINGLE, size: 8, color: '111827' },
                left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [jpRun('履　歴　書', { bold: true, size: 48 })],
                  spacing: { before: 80, after: 80 },
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(spacer(80));

  // ── 2. PHOTO + PERSONAL INFO ──────────────────────────────────────────────
  const showPhoto = cvData.personal.photoEnabled !== undefined ? cvData.personal.photoEnabled : true;
  const rawPhoto = showPhoto && cvData.personal.photo ? cvData.personal.photo : null;
  const croppedPhoto = rawPhoto ? await smartCropDataUrl(rawPhoto, 240, 320) : null;
  const photoBytes = croppedPhoto ? dataUrlToBytes(croppedPhoto) : null;

  // Photo cell: image if present, else placeholder box with 写真 label
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photoCellChildren: any[] = [];
  if (photoBytes) {
    photoCellChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({ data: photoBytes, transformation: { width: 85, height: 113 }, type: 'jpg' }),
        ],
        spacing: { before: 20, after: 20 },
      })
    );
  } else {
    // Placeholder: empty bordered inner table acting as a box
    photoCellChildren.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: thinBorder,
                shading: { fill: 'F9FAFB', type: ShadingType.SOLID, color: 'F9FAFB' },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [jpRun('写真', { size: 20, color: '9CA3AF' })],
                    spacing: { before: 180, after: 180 },
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }
  photoCellChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [jpRun('写真', { size: 14, color: '9CA3AF' })],
      spacing: { before: 20, after: 0 },
    })
  );

  // Personal info: structured as a table of label | value rows
  const personalRows = [
    // 氏名 full-width
    new TableRow({
      children: [
        labelCell('氏名', 28),
        valueCell(cvData.personal.fullName || '', 72),
      ],
    }),
    // 生年月日 | 性別
    new TableRow({
      children: [
        labelCell('生年月日', 28),
        valueCell(cvData.personal.dateOfBirth || '', 22),
        labelCell('性別', 22),
        valueCell(cvData.personal.gender || '', 28),
      ],
    }),
    // 住所 full-width
    new TableRow({
      children: [
        labelCell('住所', 28),
        valueCell(cvData.personal.address || '', 72),
      ],
    }),
    // 電話番号 | メール
    new TableRow({
      children: [
        labelCell('電話番号', 28),
        valueCell(cvData.personal.phone || '', 22),
        labelCell('メール', 22),
        valueCell(cvData.personal.email || '', 28),
      ],
    }),
  ];

  const personalTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorder,
    rows: personalRows,
  });

  // Outer layout: [personal info (75%) | photo (25%)]
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorder,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 75, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.TOP,
              borders: noBorder,
              children: [personalTable],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.TOP,
              borders: thinBorder,
              children: photoCellChildren,
            }),
          ],
        }),
      ],
    })
  );

  children.push(spacer(100));

  // ── 3. EDUCATION 学歴 ─────────────────────────────────────────────────────
  if (cvData.education.length > 0) {
    children.push(sectionHeadingRow('学　歴'));
    const eduRows = [tableHeaderRow('期間', '学校名・学部')];
    for (const edu of cvData.education) {
      const period = edu.startDate && edu.endDate
        ? `${edu.startDate}〜${edu.endDate}`
        : edu.startDate || edu.endDate || '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detailParas: any[] = [
        new Paragraph({
          children: [
            jpRun(edu.school, { bold: true, size: 20 }),
            ...(edu.degree ? [jpRun(`　${edu.degree}`, { size: 18, color: '4B5563' })] : []),
          ],
          spacing: { before: 40, after: 20 },
        }),
      ];
      if (edu.description) {
        detailParas.push(
          new Paragraph({ children: [jpRun(edu.description, { size: 16, color: '6B7280' })], spacing: { before: 0, after: 40 } })
        );
      }
      eduRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              borders: thinBorder,
              verticalAlign: VerticalAlign.TOP,
              children: [new Paragraph({ children: [jpRun(period, { size: 18, color: '6B7280' })], spacing: { before: 40, after: 40 } })],
            }),
            new TableCell({
              width: { size: 72, type: WidthType.PERCENTAGE },
              borders: thinBorder,
              verticalAlign: VerticalAlign.TOP,
              children: detailParas,
            }),
          ],
        })
      );
    }
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorder, rows: eduRows }));
    children.push(spacer(80));
  }

  // ── 4. WORK EXPERIENCE 職歴 ───────────────────────────────────────────────
  if (cvData.experience.length > 0) {
    children.push(sectionHeadingRow('職　歴'));
    const expRows = [tableHeaderRow('期間', '会社名・職位・職務内容')];
    for (const exp of cvData.experience) {
      const period = exp.startDate
        ? `${exp.startDate}〜${exp.isPresent ? '現在' : exp.endDate || ''}`
        : '';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detailParas: any[] = [
        new Paragraph({ children: [jpRun(exp.company, { bold: true, size: 20 })], spacing: { before: 40, after: 20 } }),
      ];
      if (exp.position) {
        detailParas.push(
          new Paragraph({ children: [jpRun(exp.position, { size: 18, color: '374151' })], spacing: { before: 0, after: 20 } })
        );
      }
      if (exp.description) {
        for (const line of exp.description.split('\n')) {
          if (line.trim()) {
            detailParas.push(
              new Paragraph({
                children: [jpRun('・', { size: 16, color: '6B7280' }), jpRun(line.replace(/^[-•・]\s*/, ''), { size: 16, color: '6B7280' })],
                spacing: { before: 0, after: 20 },
              })
            );
          }
        }
      }
      expRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              borders: thinBorder,
              verticalAlign: VerticalAlign.TOP,
              children: [new Paragraph({ children: [jpRun(period, { size: 18, color: '6B7280' })], spacing: { before: 40, after: 40 } })],
            }),
            new TableCell({
              width: { size: 72, type: WidthType.PERCENTAGE },
              borders: thinBorder,
              verticalAlign: VerticalAlign.TOP,
              children: detailParas,
            }),
          ],
        })
      );
    }
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorder, rows: expRows }));
    children.push(spacer(80));
  }

  // ── 5. SKILLS スキル (2-column table grid) ────────────────────────────────
  if (cvData.skills.length > 0) {
    children.push(sectionHeadingRow('スキル'));
    // Pair skills into rows of 2
    const skillPairs: string[][] = [];
    for (let i = 0; i < cvData.skills.length; i += 2) {
      skillPairs.push([cvData.skills[i], cvData.skills[i + 1] || '']);
    }
    const skillRows = skillPairs.map(([a, b]) =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            children: [new Paragraph({ children: [jpRun(a, { size: 20, color: '374151' })], spacing: { before: 40, after: 40 } })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            children: [new Paragraph({ children: [jpRun(b, { size: 20, color: '374151' })], spacing: { before: 40, after: 40 } })],
          }),
        ],
      })
    );
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorder, rows: skillRows }));
    children.push(spacer(80));
  }

  // ── 6. LANGUAGES 語学 (one per row: Language | Level) ─────────────────────
  if (cvData.languages.length > 0) {
    children.push(sectionHeadingRow('語学'));
    const langHeaderRow = new TableRow({
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: thinBorder,
          shading: headerBg,
          children: [new Paragraph({ children: [jpRun('言語', { bold: true, size: 18, color: '374151' })], spacing: { before: 40, after: 40 } })],
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          borders: thinBorder,
          shading: headerBg,
          children: [new Paragraph({ children: [jpRun('レベル', { bold: true, size: 18, color: '374151' })], spacing: { before: 40, after: 40 } })],
        }),
      ],
    });
    const langRows = [langHeaderRow, ...cvData.languages.map(lang =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            children: [new Paragraph({ children: [jpRun(lang.name, { bold: true, size: 20 })], spacing: { before: 40, after: 40 } })],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            children: [new Paragraph({ children: [jpRun(lang.level || '', { size: 20, color: '4B5563' })], spacing: { before: 40, after: 40 } })],
          }),
        ],
      })
    )];
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorder, rows: langRows }));
    children.push(spacer(80));
  }

  // ── 7. SUMMARY 自己PR (inside table cell) ────────────────────────────────
  if (cvData.summary) {
    children.push(sectionHeadingRow('自己PR'));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: thinBorder,
                children: [
                  new Paragraph({
                    children: [jpRun(cvData.summary, { size: 20, color: '374151' })],
                    spacing: { before: 80, after: 80 },
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
    children.push(spacer(80));
  }

  // ── 8. CERTIFICATIONS 資格・免許 ─────────────────────────────────────────
  if (cvData.certifications.length > 0) {
    children.push(sectionHeadingRow('資格・免許'));
    const certRows = cvData.certifications.map(cert =>
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: thinBorder,
            children: [
              new Paragraph({
                children: [jpRun('・', { size: 20, color: '4B5563' }), jpRun(cert, { size: 20, color: '374151' })],
                spacing: { before: 40, after: 40 },
              }),
            ],
          }),
        ],
      })
    );
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorder, rows: certRows }));
  }

  // ── Build and download document ───────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { size: 20, color: '111827', font: { eastAsia: 'MS Mincho' } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  await saveFileViaPlatform(blob, `${fileName}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

// ─── Noto Sans @font-face injection helpers ───────────────────────────────────
// These ensure html2canvas and the print window both use Noto Sans (full Unicode)
// instead of falling back to system fonts that may lack glyphs for special chars.

/**
 * Build @font-face CSS rules that load Noto Sans TTF files from /fonts/.
 * Covers: Latin Extended (č ć š đ ž), Cyrillic (ru), Arabic (ar),
 * Devanagari / Hindi (hi), Japanese CJK (ja).
 */
function notoFontFaceCSS(): string {
  const base = typeof window !== 'undefined'
    ? `${window.location.origin}/fonts`
    : '/fonts';
  return `
@font-face {
  font-family: 'NotoSans';
  font-weight: 400;
  font-style: normal;
  src: url('${base}/NotoSans-Regular.ttf') format('truetype');
}
@font-face {
  font-family: 'NotoSans';
  font-weight: 700;
  font-style: normal;
  src: url('${base}/NotoSans-Bold.ttf') format('truetype');
}
@font-face {
  font-family: 'NotoSansArabic';
  font-weight: 400;
  font-style: normal;
  src: url('${base}/NotoSansArabic-Regular.ttf') format('truetype');
}
@font-face {
  font-family: 'NotoSansArabic';
  font-weight: 700;
  font-style: normal;
  src: url('${base}/NotoSansArabic-Bold.ttf') format('truetype');
}
@font-face {
  font-family: 'NotoSansDevanagari';
  font-weight: 400;
  font-style: normal;
  src: url('${base}/NotoSansDevanagari-Regular.ttf') format('truetype');
}
@font-face {
  font-family: 'NotoSansDevanagari';
  font-weight: 700;
  font-style: normal;
  src: url('${base}/NotoSansDevanagari-Bold.ttf') format('truetype');
}
@font-face {
  font-family: 'NotoSansJP';
  font-weight: 400;
  font-style: normal;
  src: url('${base}/NotoSansJP-Regular.ttf') format('truetype');
}
@font-face {
  font-family: 'NotoSansJP';
  font-weight: 700;
  font-style: normal;
  src: url('${base}/NotoSansJP-Bold.ttf') format('truetype');
}
`.trim();
}

/**
 * Inject a <style> tag with Noto Sans @font-face declarations into <head>
 * and wait for all declared fonts to load via document.fonts.ready.
 * Returns a cleanup function that removes the injected style tag.
 */
async function injectAndAwaitNotoFonts(): Promise<() => void> {
  const styleEl = document.createElement('style');
  styleEl.id = '__noto-pdf-fonts__';
  styleEl.textContent = notoFontFaceCSS();
  document.head.appendChild(styleEl);

  try {
    // Trigger load for all Noto families so Arabic, Hindi, Japanese, and Latin
    // glyphs are available when html2canvas captures the DOM.
    await Promise.all([
      document.fonts.load('400 16px NotoSans'),
      document.fonts.load('700 16px NotoSans'),
      document.fonts.load('400 16px NotoSansArabic'),
      document.fonts.load('700 16px NotoSansArabic'),
      document.fonts.load('400 16px NotoSansDevanagari'),
      document.fonts.load('700 16px NotoSansDevanagari'),
      document.fonts.load('400 16px NotoSansJP'),
      document.fonts.load('700 16px NotoSansJP'),
    ]);
    await document.fonts.ready;
  } catch {
    // Font load errors are non-fatal – continue with whatever loaded
  }

  return () => {
    if (styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  };
}

// ─── PDF Export ──────────────────────────────────────────────────────────────

export async function exportToPDF(elementId: string, fileName: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`PDF export: element #${elementId} not found in DOM`);

  // ── Step 1: load libraries ────────────────────────────────────────────────
  let html2canvasFn: typeof import('html2canvas').default;
  let jsPDFCtor: typeof import('jspdf').jsPDF;
  try {
    const h2cMod = await import('html2canvas');
    // Handles both ESM default export and CJS module.exports shapes
    html2canvasFn = (h2cMod.default ?? h2cMod) as typeof import('html2canvas').default;
    const jspdfMod = await import('jspdf');
    jsPDFCtor = (jspdfMod.jsPDF ?? jspdfMod.default) as typeof import('jspdf').jsPDF;
  } catch (libErr) {
    console.error('[exportToPDF] Failed to load PDF libraries:', libErr);
    throw libErr;
  }

  if (typeof html2canvasFn !== 'function') {
    throw new Error('[exportToPDF] html2canvas is not a function after import');
  }

  // ── Step 2: inject Noto Sans fonts so html2canvas renders Unicode correctly ─
  // This ensures characters like č ć š đ ž (Latin Ext), Cyrillic, Arabic,
  // Hindi, and Japanese are rendered from a known TTF instead of a system
  // fallback font that may not have those glyphs.
  const removeNotoFonts = await injectAndAwaitNotoFonts();

  // ── Step 3: temporarily override font-family to NotoSans on the CV element ─
  // The CV templates use Tailwind's `font-sans` which resolves to the system
  // sans-serif stack. For non-Latin scripts (Cyrillic, Arabic, Devanagari, CJK)
  // the system font may not have the required glyphs, causing broken characters.
  // We temporarily force NotoSans (which we just loaded) so all Unicode renders.
  const prevFontFamily = element.style.fontFamily;
  element.style.fontFamily = "'NotoSans', 'NotoSansArabic', 'NotoSansDevanagari', 'NotoSansJP', sans-serif";

  // ── Step 4: temporarily remove overflow clipping so html2canvas captures  ─
  //    the full scrollable content, not just the visible viewport slice.
  const prevOverflow = element.style.overflow;
  const prevMaxHeight = element.style.maxHeight;
  element.style.overflow = 'visible';
  element.style.maxHeight = 'none';

  // Reset scroll position to top so html2canvas captures from the very beginning
  // (prevents the top of the CV — e.g. the header — from being cut off when
  // the user has scrolled the preview container down).
  const prevScrollTop = element.scrollTop;
  const prevScrollLeft = element.scrollLeft;
  element.scrollTop = 0;
  element.scrollLeft = 0;

  // Also expand any direct child that may be scroll-clipped, and apply font
  // override to it too (since we now capture firstChild directly).
  const firstChild = element.firstElementChild as HTMLElement | null;
  let childPrevOverflow = '';
  let childPrevMaxHeight = '';
  let childPrevScrollTop = 0;
  let childPrevFontFamily = '';
  if (firstChild) {
    childPrevOverflow = firstChild.style.overflow;
    childPrevMaxHeight = firstChild.style.maxHeight;
    childPrevScrollTop = firstChild.scrollTop;
    childPrevFontFamily = firstChild.style.fontFamily;
    firstChild.style.overflow = 'visible';
    firstChild.style.maxHeight = 'none';
    firstChild.scrollTop = 0;
    firstChild.style.fontFamily = "'NotoSans', 'NotoSansArabic', 'NotoSansDevanagari', 'NotoSansJP', sans-serif";
  }

  // A4 dimensions in mm
  const PDF_WIDTH_MM = 210;
  const PDF_HEIGHT_MM = 297;
  const scale = 2;

  // ── Step 4c: flush two animation frames so any pending React state updates
  //    (e.g. rectPhotoUrl injection into localizedPreviewCv) have painted to the DOM
  //    before html2canvas reads the <img src> attributes.
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  // ── Visual debug: stamp a red border + label on every <img> that html2canvas
  //    will capture (dev-only). This lets you see in the live preview EXACTLY which image
  //    node is being used before the PDF is generated.
  const debugOverlays: Array<{ el: HTMLImageElement; prevOutline: string; prevPosition: string }> = [];
  const debugLabels: HTMLElement[] = [];
  if (process.env.NODE_ENV !== 'production') {
    const allImgs = element.querySelectorAll('img');
    allImgs.forEach((imgEl, _i) => {
      const src = imgEl.getAttribute('src') ?? '';
      const isDataUrl = src.startsWith('data:');
      const mime = isDataUrl ? src.slice(5, src.indexOf(';')) : src.slice(0, 60);
      const isRect = src.includes('#rect');

      // Red border on the captured img
      const prevOutline = (imgEl as HTMLElement).style.outline;
      const prevPosition = (imgEl as HTMLElement).style.position;
      (imgEl as HTMLElement).style.outline = '3px solid red';
      (imgEl as HTMLElement).style.position = 'relative';
      debugOverlays.push({ el: imgEl as HTMLImageElement, prevOutline, prevPosition });

      // Label above the img showing RECT or CIRCLE
      const label = document.createElement('div');
      label.textContent = `EXPORT IMAGE SOURCE = ${isRect ? 'RECT ✓' : `CIRCLE ✗ (mime:${mime})`}`;
      label.style.cssText = [
        'position:absolute',
        'top:0',
        'left:0',
        'background:red',
        'color:white',
        'font:bold 10px monospace',
        'padding:2px 4px',
        'z-index:9999',
        'pointer-events:none',
        'white-space:nowrap',
      ].join(';');
      // Insert before the img's parent so it appears in the captured area
      const parent = imgEl.parentElement;
      if (parent) {
        const origParentPos = parent.style.position;
        if (!origParentPos || origParentPos === 'static') parent.style.position = 'relative';
        parent.insertBefore(label, imgEl);
        debugLabels.push(label);
        // store orig parent position for cleanup
        (label as HTMLElement & { _origParentPos?: string })._origParentPos = origParentPos;
      }
    });
  }

  let canvas: HTMLCanvasElement;
  try {
    // ── HARD VERIFICATION: capture the actual template child directly, not the
    //    scroll wrapper. The #cv-preview / #cv-inline-preview div is an
    //    overflow-auto container — html2canvas on that wrapper can silently clip
    //    to the visible viewport and miss styles on the child template element.
    //    By targeting the template child directly we guarantee we capture exactly
    //    what is rendered, including any background-color changes.
    const captureTarget = (firstChild as HTMLElement | null) ?? element;
    const captureWidth = Math.max(captureTarget.scrollWidth, captureTarget.offsetWidth);
    const captureHeight = Math.max(captureTarget.scrollHeight, captureTarget.offsetHeight);

    if (process.env.NODE_ENV !== 'production') {
      console.log('[exportToPDF] captureTarget:', captureTarget.tagName, captureTarget.className.slice(0, 80));
      console.log('[exportToPDF] capture dims:', captureWidth, '×', captureHeight);
    }

    canvas = await html2canvasFn(captureTarget, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
    });
  } catch (captureErr) {
    console.error('[exportToPDF] html2canvas capture failed:', captureErr);
    throw captureErr;
  } finally {
    // ── Step 4b: always restore all temporary styles and remove injected fonts ─
    element.style.fontFamily = prevFontFamily;
    element.style.overflow = prevOverflow;
    element.style.maxHeight = prevMaxHeight;
    element.scrollTop = prevScrollTop;
    element.scrollLeft = prevScrollLeft;
    if (firstChild) {
      firstChild.style.overflow = childPrevOverflow;
      firstChild.style.maxHeight = childPrevMaxHeight;
      firstChild.scrollTop = childPrevScrollTop;
      firstChild.style.fontFamily = childPrevFontFamily;
    }
    removeNotoFonts();
    // ── Clean up debug overlays ──────────────────────────────────────────────
    debugOverlays.forEach(({ el, prevOutline, prevPosition }) => {
      el.style.outline = prevOutline;
      el.style.position = prevPosition;
    });
    debugLabels.forEach(label => {
      const parent = label.parentElement;
      if (parent) {
        const origPos = (label as HTMLElement & { _origParentPos?: string })._origParentPos;
        if (origPos !== undefined) parent.style.position = origPos;
        parent.removeChild(label);
      }
    });
  }

  // ── Step 5: sanity-check the canvas ──────────────────────────────────────
  if (canvas.width === 0 || canvas.height === 0) {
    throw new Error('[exportToPDF] html2canvas produced an empty canvas (0×0). Element may be hidden or zero-sized.');
  }

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const canvasWidthPx = canvas.width;
  const canvasHeightPx = canvas.height;

  const contentHeightMM = (canvasHeightPx / canvasWidthPx) * PDF_WIDTH_MM;
  const useSinglePage = contentHeightMM <= PDF_HEIGHT_MM * 1.05;

  // ── Step 6: build PDF ─────────────────────────────────────────────────────
  try {
    const pdf = new jsPDFCtor({
      orientation: 'portrait',
      unit: 'mm',
      format: useSinglePage ? [PDF_WIDTH_MM, Math.min(contentHeightMM, PDF_HEIGHT_MM)] : 'a4',
    });

    if (useSinglePage) {
      pdf.addImage(imgData, 'JPEG', 0, 0, PDF_WIDTH_MM, contentHeightMM);
    } else {
      const pageHeightPx = (PDF_HEIGHT_MM / PDF_WIDTH_MM) * canvasWidthPx;
      let offsetY = 0;
      let firstPage = true;

      while (offsetY < canvasHeightPx) {
        if (!firstPage) pdf.addPage();
        firstPage = false;

        const sliceHeight = Math.min(pageHeightPx, canvasHeightPx - offsetY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvasWidthPx;
        sliceCanvas.height = sliceHeight;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, offsetY, canvasWidthPx, sliceHeight, 0, 0, canvasWidthPx, sliceHeight);
        }
        const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightMM = (sliceHeight / canvasWidthPx) * PDF_WIDTH_MM;
        pdf.addImage(sliceImg, 'JPEG', 0, 0, PDF_WIDTH_MM, sliceHeightMM);

        offsetY += pageHeightPx;
      }
    }

    // On Android: use native save dialog. On web: use blob download.
    if (isNative()) {
      const pdfBlob = pdfToBlob(pdf);
      if (pdfBlob) {
        await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
      } else {
        // Fallback: save directly if blob extraction fails
        pdf.save(`${fileName}.pdf`);
      }
    } else {
      pdf.save(`${fileName}.pdf`);
    }
  } catch (pdfErr) {
    console.error('[exportToPDF] jsPDF generation failed:', pdfErr);
    throw pdfErr;
  }
}

// ─── PDF Print Fallback ───────────────────────────────────────────────────────
// Opens the preview content in a dedicated print window so the browser's
// "Save as PDF" dialog can be used when direct PDF generation fails.
// Noto Sans @font-face rules are injected so all Unicode characters render
// correctly (č ć š đ ž, Cyrillic, Arabic, Hindi, Japanese).

export function openPrintFallback(elementId: string, fileName: string): void {
  // Native Android must NOT call window.open — route through printNativePdf instead
  if (isNative()) {
    const element = document.getElementById(elementId);
    if (element) printNativePdf(element, fileName);
    return;
  }
  const element = document.getElementById(elementId);
  if (!element) return;

  // Collect all <style> and <link rel="stylesheet"> tags from the current page
  const pageStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(node => node.outerHTML)
    .join('\n');

  const printWindow = window.open('', '_blank', 'width=900,height=1200');
  if (!printWindow) return;

  const fontBase = `${window.location.origin}/fonts`;
  const notoFontCSS = `
@font-face { font-family: 'NotoSans'; font-weight: 400; src: url('${fontBase}/NotoSans-Regular.ttf') format('truetype'); }
@font-face { font-family: 'NotoSans'; font-weight: 700; src: url('${fontBase}/NotoSans-Bold.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansArabic'; font-weight: 400; src: url('${fontBase}/NotoSansArabic-Regular.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansArabic'; font-weight: 700; src: url('${fontBase}/NotoSansArabic-Bold.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansDevanagari'; font-weight: 400; src: url('${fontBase}/NotoSansDevanagari-Regular.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansDevanagari'; font-weight: 700; src: url('${fontBase}/NotoSansDevanagari-Bold.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansJP'; font-weight: 400; src: url('${fontBase}/NotoSansJP-Regular.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansJP'; font-weight: 700; src: url('${fontBase}/NotoSansJP-Bold.ttf') format('truetype'); }
`;

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${fileName}</title>
  ${pageStyles}
  <style>
    ${notoFontCSS}
    @page { margin: 0; size: A4; }
    body { margin: 0; padding: 0; background: #fff; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>${element.innerHTML}</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  // Give fonts time to load before triggering print
  setTimeout(() => {
    printWindow.print();
  }, 800);
}

// ─── Cover Letter PDF Export (text-based, via @react-pdf/renderer) ───────────

/**
 * Generate and download a properly formatted Cover Letter PDF.
 * Uses @react-pdf/renderer – no html2canvas, no screenshots.
 *
 * @param candidateName - Full name displayed at the top and as signature
 * @param content       - Raw letter text (paragraphs separated by newlines)
 * @param fileName      - Download filename (without extension)
 * @param locale        - App locale code for date formatting
 */
export async function exportCoverLetterToPDF(
  candidateName: string,
  content: string,
  fileName: string,
  locale: string,
): Promise<void> {
  // Dynamic import so the heavy @react-pdf/renderer bundle is only loaded on demand
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdfFn: any, createElementFn: any, CoverLetterPDFDocumentComp: any;

  try {
    const [rendererMod, reactMod, clPdfMod] = await Promise.all([
      import('@react-pdf/renderer'),
      import('react'),
      import('./cover-letter-pdf'),
    ]);
    pdfFn                    = rendererMod.pdf;
    createElementFn          = reactMod.createElement;
    CoverLetterPDFDocumentComp = clPdfMod.CoverLetterPDFDocument;
  } catch (importErr) {
    console.error('[Cover Letter PDF] Failed to load PDF modules:', importErr);
    throw importErr;
  }

  let blob: Blob;
  try {
    const doc = createElementFn(CoverLetterPDFDocumentComp, { candidateName, content, locale });
    blob = await pdfFn(doc).toBlob();
  } catch (renderErr) {
    console.error('[Cover Letter PDF] Render failed — locale:', locale, 'error:', renderErr);
    if (renderErr instanceof Error && renderErr.stack) {
      console.error('[Cover Letter PDF] Stack:', renderErr.stack);
    }
    throw renderErr;
  }

  await saveFileViaPlatform(blob, `${fileName}.pdf`, 'application/pdf');
}

// ─── Cover Letter DOCX Export (plain text) ───────────────────────────────────

/**
 * Strip any leading lines that are exactly the candidate name.
 * Mirrors the same helper in cover-letter-pdf.tsx so DOCX and PDF behave identically.
 */
export function stripLeadingNameForDocx(raw: string, candidateName: string): string {
  if (!candidateName.trim()) return raw;
  const nameLower = candidateName.trim().toLowerCase();
  const lines = raw.split('\n');
  while (lines.length > 0 && lines[0].trim().toLowerCase() === nameLower) {
    lines.shift();
  }
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  return lines.join('\n');
}

/**
 * Strip any leading line that looks like a date (contains a 4-digit year).
 * Mirrors the same helper in cover-letter-pdf.tsx.
 */
export function stripLeadingDateForDocx(text: string): string {
  const lines = text.split('\n');
  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }
  if (lines.length > 0 && /\b\d{4}\b/.test(lines[0].trim())) {
    lines.shift();
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
  }
  return lines.join('\n');
}

export async function exportCoverLetterToDOCX(content: string, fileName: string, candidateName = '', locale: Locale = 'en'): Promise<void> {
  // Apply same stripping logic as PDF: remove leading name header, then leading date
  const afterName = stripLeadingNameForDocx(content, candidateName);
  const text = stripLeadingDateForDocx(afterName);

  // Locale-aware font selection (mirrors cover-letter-pdf.tsx)
  let fontFamily: string;
  let isRTL = false;
  switch (locale) {
    case 'ar':
      fontFamily = 'NotoSansArabic';
      isRTL = true;
      break;
    case 'hi':
      fontFamily = 'NotoSansDevanagari';
      break;
    case 'ja':
      fontFamily = 'NotoSansJP';
      break;
    default:
      fontFamily = 'NotoSans';
      break;
  }

  const { Document, Packer, Paragraph, TextRun, AlignmentType } = await import('docx');

  // Today's date formatted per locale
  const dateStr = new Intl.DateTimeFormat(
    locale === 'en' ? 'en-US' :
    locale === 'de' ? 'de-DE' :
    locale === 'es' ? 'es-ES' :
    locale === 'fr' ? 'fr-FR' :
    locale === 'it' ? 'it-IT' :
    locale === 'ar' ? 'ar-EG' :
    locale === 'sr' ? 'sr-Latn-RS' :
    locale === 'hr' ? 'hr-HR' :
    locale === 'ru' ? 'ru-RU' :
    locale === 'pt-BR' ? 'pt-BR' :
    locale === 'hi' ? 'hi-IN' :
    'ja-JP',
    { dateStyle: 'long' },
  ).format(new Date());

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paragraphs: any[] = [];

  // Date line
  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: dateStr, font: fontFamily, size: 20, color: '6B7280' })],
      spacing: { after: 300 },
      alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT,
    }),
  );

  // Spacing
  paragraphs.push(new Paragraph({ spacing: { after: 200 }, children: [] }));

  // Body paragraphs
  const bodyLines = text.split('\n');
  for (const line of bodyLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      paragraphs.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
      continue;
    }
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: trimmed, font: fontFamily, size: 22, color: '1F2937' })],
        spacing: { after: 160 },
        alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT,
        bidirectional: isRTL,
      }),
    );
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: fontFamily, size: 22, color: '1F2937' },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
          ...(isRTL ? { bidi: true } : {}),
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  await saveFileViaPlatform(blob, `${fileName}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
