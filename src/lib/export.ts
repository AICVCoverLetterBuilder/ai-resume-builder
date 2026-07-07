import type { CVData } from './types';
import { regionSettings } from './types';
import { translations, type Locale } from './i18n/translations';
import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { createAtsStandardPdfTemplate } from './ats-standard-pdf-template';
import { createContemporaryBoldPdfTemplate } from './contemporary-bold-pdf-template';
import { createCorporateNavyPdfTemplate } from './corporate-navy-pdf-template';
import { createElegantFormalPdfTemplate } from './elegant-formal-pdf-template';
import { createExecutivePremiumPdfTemplate } from './executive-premium-pdf-template';
import { createModernMinimalPdfTemplate } from './modern-minimal-pdf-template';
import { createCleanSimplePdfTemplate, splitCleanSimpleSummaryParagraphBlocks, splitCleanSimpleSummarySentenceRuns } from './clean-simple-pdf-template';
import { createProfessionalClassicPdfTemplate } from './professional-classic-pdf-template';
import { createCreativeArtisticPdfTemplate } from './creative-artistic-pdf-template';
import { createNordicCleanPdfTemplate } from './nordic-clean-pdf-template';
import { createRirekishoPdfTemplate } from './rirekisho-pdf-template';
import { createTechSidebarPdfTemplate } from './tech-sidebar-pdf-template';
import { isNative } from './iap';
import { saveFileViaPlatform, pdfToBlob, SaveFailedError, type SaveFileResult } from './native-save';
import { printNativePdf } from './native-print';
import {
  ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT,
  ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH,
  ELEGANT_FORMAL_PHOTO_HEIGHT,
  ELEGANT_FORMAL_PHOTO_WIDTH,
  isCleanElegantFormalPortraitPhoto,
  type ElegantFormalCanonicalPhotoResult,
} from './elegant-formal-photo';

// ─── Clipboard Export ────────────────────────────────────────────────────────

export function exportToClipboard(elementId: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return Promise.resolve();
  const text = (element as HTMLElement).innerText;
  return navigator.clipboard.writeText(text);
}

// ─── DOCX Template Config ────────────────────────────────────────────────────

type DocxLayout = 'single' | 'sidebar-left' | 'dark-header' | 'centered-dark-header';

export const CV_PDF_A4_WIDTH_MM = 210;
export const CV_PDF_A4_HEIGHT_MM = 297;
const PDF_TRAILING_SLICE_TOLERANCE_MM = 4;
const EXPORT_IMAGE_TIMEOUT_MS = 4000;

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
  customLayout?: 'modern-minimal' | 'clean-simple' | 'professional-classic' | 'creative-artistic' | 'elegant-formal' | 'executive-premium' | 'nordic-clean' | 'tech-sidebar' | 'corporate-navy' | 'modern-minimal-executive' | 'contemporary-bold';
}

const DOCX_TEMPLATE_CONFIGS: Record<string, DocxTemplateConfig> = {
  'modern-minimal': {
    accent: '4F46E5', headerBg: 'FFFFFF', headerText: '111827',
    titleColor: '4F46E5', headingColor: '4F46E5', headingBorder: '4F46E5',
    layout: 'single', sidebarPct: 0, photoShape: 'circle', photoSize: 110, font: 'Calibri',
    photoSide: 'right', headerAlignment: 'left', showHeadingBorder: true, uppercaseHeadings: true,
    customLayout: 'modern-minimal',
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
    layout: 'single', sidebarPct: 0, photoShape: 'circle', photoSize: 84, font: 'Calibri',
    photoSide: 'left', headerAlignment: 'left', showHeadingBorder: true, uppercaseHeadings: true,
    dividerColor: 'D1D5DB',
    customLayout: 'clean-simple',
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
    layout: 'centered-dark-header', sidebarPct: 0, photoShape: 'portrait', photoSize: 66, font: 'Georgia',
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
    customLayout: 'corporate-navy',
  },
};

const DEFAULT_DOCX_CONFIG: DocxTemplateConfig = DOCX_TEMPLATE_CONFIGS['modern-minimal'];

function getDocxConfig(templateId?: string): DocxTemplateConfig {
  if (!templateId) return DEFAULT_DOCX_CONFIG;
  return DOCX_TEMPLATE_CONFIGS[templateId] ?? DEFAULT_DOCX_CONFIG;
}

function stripUrlFragment(src: string): string {
  if (src.startsWith('data:')) return src.split('#')[0];
  return src;
}

function isDataImageUrl(src: string): boolean {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(stripUrlFragment(src));
}

function imageMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) return 'image/png';
  if (
    bytes.length >= 12
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) return 'image/webp';
  if (bytes.length >= 6) {
    const signature = String.fromCharCode(...bytes.slice(0, 6));
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif';
  }
  return null;
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64') as unknown as Uint8Array;
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = stripUrlFragment(dataUrl).split(',')[1];
  if (!base64) throw new Error('Invalid image data URL');
  return base64ToBytes(base64);
}

function normalizeRawBase64ImageDataUrl(src: string): string | null {
  const cleanSrc = stripUrlFragment(src.trim());
  if (!cleanSrc || /^(?:data:|blob:|file:|content:|capacitor:|https?:)/i.test(cleanSrc)) return null;
  if (!/^[a-zA-Z0-9+/=\s_-]+$/.test(cleanSrc)) return null;
  try {
    const normalizedBase64 = cleanSrc.replace(/[\s_-]/g, (char) => (char === '_' ? '/' : char === '-' ? '+' : ''));
    const bytes = base64ToBytes(normalizedBase64);
    const mime = imageMimeFromBytes(bytes);
    if (!mime) return null;
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

function getImageMimeFromDataUrl(dataUrl: string): string | null {
  const match = stripUrlFragment(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
  return match?.[1] ?? null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image blob'));
    reader.readAsDataURL(blob);
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function canFetchExportImageSource(src: string): boolean {
  if (src.startsWith('blob:') || src.startsWith('file:') || src.startsWith('content:') || src.startsWith('capacitor:')) return true;
  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
      const runtimeOrigin = window.location.origin !== 'null'
        ? window.location.origin
        : new URL(document.baseURI).origin;
      return new URL(src).origin === runtimeOrigin;
    } catch {
      return false;
    }
  }
  return false;
}

function resolveBrowserImageSource(src: string): string {
  if (/^(?:data:|blob:|file:|capacitor:|https?:)/i.test(src)) return src;
  if (typeof window === 'undefined') return src;

  try {
    const baseUrl = typeof document !== 'undefined' && document.baseURI && document.baseURI !== 'about:blank'
      ? document.baseURI
      : window.location.href;
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

export async function resolveExportImageDataUrl(src: string, timeoutMs = EXPORT_IMAGE_TIMEOUT_MS): Promise<string | null> {
  const cleanSrc = resolveBrowserImageSource(stripUrlFragment(src.trim()));
  if (!cleanSrc) return null;
  if (isDataImageUrl(cleanSrc)) return cleanSrc;
  const rawBase64DataUrl = normalizeRawBase64ImageDataUrl(cleanSrc);
  if (rawBase64DataUrl) return rawBase64DataUrl;
  if (typeof window === 'undefined' || typeof window.fetch !== 'function' || !canFetchExportImageSource(cleanSrc)) return null;

  try {
    const response = await withTimeout(window.fetch(cleanSrc), timeoutMs, 'Timed out fetching export image');
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return null;
    return await withTimeout(blobToDataUrl(blob), timeoutMs, 'Timed out converting export image');
  } catch {
    return null;
  }
}

function resolveProfessionalClassicImageSource(src: string | null): string | null {
  const cleanSrc = src?.trim();
  if (!cleanSrc) return null;
  if (/^(?:data:|blob:|file:|capacitor:|https?:)/i.test(cleanSrc)) return cleanSrc;
  if (typeof window === 'undefined') return cleanSrc;

  try {
    const baseUrl = typeof document !== 'undefined' && document.baseURI && document.baseURI !== 'about:blank'
      ? document.baseURI
      : window.location.href;
    return new URL(cleanSrc, baseUrl).href;
  } catch {
    return cleanSrc;
  }
}

export async function prepareCvPhotoForExport(src: string | null | undefined, timeoutMs = EXPORT_IMAGE_TIMEOUT_MS): Promise<{
  dataUrl: string;
  bytes: Uint8Array;
  mimeType: string;
} | null> {
  const cleanSrc = src?.trim();
  if (!cleanSrc) return null;
  const dataUrl = await resolveExportImageDataUrl(cleanSrc, timeoutMs)
    ?? (isDataImageUrl(cleanSrc) ? stripUrlFragment(cleanSrc) : normalizeRawBase64ImageDataUrl(cleanSrc));
  if (!dataUrl) return null;
  try {
    const bytes = dataUrlToBytes(dataUrl);
    const mimeType = getImageMimeFromDataUrl(dataUrl) ?? imageMimeFromBytes(bytes);
    if (!mimeType?.startsWith('image/')) return null;
    return { dataUrl, bytes, mimeType };
  } catch {
    return null;
  }
}

export function decodeImageForExport(src: string, timeoutMs = EXPORT_IMAGE_TIMEOUT_MS): Promise<boolean> {
  return withTimeout(new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') await img.decode();
        resolve(true);
      } catch {
        resolve(true);
      }
    };
    img.onerror = () => resolve(false);
    img.src = src;
  }), timeoutMs, 'Timed out decoding export image').catch(() => false);
}

async function imageElementToDataUrl(img: HTMLImageElement, mimeType = 'image/png'): Promise<string | null> {
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (width <= 0 || height <= 0) return null;
  try {
    if (typeof img.decode === 'function') await img.decode().catch(() => undefined);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL(mimeType);
    return isDataImageUrl(dataUrl) ? dataUrl : null;
  } catch {
    return null;
  }
}

type PreparedExportImage = {
  img: HTMLImageElement;
  frame: HTMLElement;
  previousSrc: string | null;
  previousAlt: string | null;
  previousFrameDisplay: string;
};

type ExecutivePremiumCanonicalPhotoResult = {
  dataUrl: string;
  bytes: Uint8Array;
  mimeType: 'image/jpeg';
  width: 180;
  height: 240;
  source: 'original-photo' | 'validated-rectangular';
};

type NordicCleanCanonicalPhotoResult = {
  dataUrl: string;
  bytes: Uint8Array;
  mimeType: 'image/jpeg';
  width: 164;
  height: 164;
  source: 'original-photo';
};

type TechSidebarCanonicalPhotoResult = {
  dataUrl: string;
  bytes: Uint8Array;
  mimeType: 'image/jpeg';
  width: 164;
  height: 164;
  source: 'original-photo' | 'selected-photo';
};

type CorporateNavyCanonicalPhotoResult = {
  dataUrl: string;
  bytes: Uint8Array;
  mimeType: 'image/jpeg';
  width: 164;
  height: 164;
  source: 'original-photo' | 'selected-photo';
};

type ContemporaryBoldCanonicalPhotoResult = CorporateNavyCanonicalPhotoResult;

type RirekishoCanonicalPhotoResult = {
  dataUrl: string;
  bytes: Uint8Array;
  mimeType: 'image/jpeg';
  width: 270;
  height: 360;
  source: 'original-photo' | 'selected-photo';
};

function inspectRectangularPhotoDataUrl(dataUrl: string): Promise<{
  width: number;
  height: number;
  hasAlpha: boolean;
  hasTransparentCorner: boolean;
  hasArtificialBlackCorners: boolean;
  hasArtificialWhiteCorners: boolean;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not inspect Executive Premium photo'));
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const read = (x: number, y: number) => {
        const index = (y * canvas.width + x) * 4;
        return {
          r: imageData.data[index] ?? 0,
          g: imageData.data[index + 1] ?? 0,
          b: imageData.data[index + 2] ?? 0,
          a: imageData.data[index + 3] ?? 0,
        };
      };
      const corners = [
        read(0, 0),
        read(canvas.width - 1, 0),
        read(0, canvas.height - 1),
        read(canvas.width - 1, canvas.height - 1),
      ];
      const hasAlpha = imageData.data.some((value, index) => index % 4 === 3 && value < 255);
      const transparent = corners.some(pixel => pixel.a < 255);
      const black = corners.every(pixel => pixel.r <= 12 && pixel.g <= 12 && pixel.b <= 12);
      const white = corners.every(pixel => pixel.r >= 245 && pixel.g >= 245 && pixel.b >= 245);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        hasAlpha,
        hasTransparentCorner: transparent,
        hasArtificialBlackCorners: black,
        hasArtificialWhiteCorners: white,
      });
    };
    img.onerror = () => reject(new Error('Could not load Executive Premium photo'));
    img.src = dataUrl;
  });
}

function createExecutivePremiumPortraitPhoto(sourceDataUrl: string, targetWidth = 180, targetHeight = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create Executive Premium photo canvas'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      const scale = Math.max(targetWidth / img.naturalWidth, targetHeight / img.naturalHeight);
      const scaledW = img.naturalWidth * scale;
      const scaledH = img.naturalHeight * scale;
      ctx.drawImage(img, (targetWidth - scaledW) / 2, (targetHeight - scaledH) / 2, scaledW, scaledH);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('Could not load Executive Premium photo source'));
    img.src = sourceDataUrl;
  });
}

function createNordicCleanSquarePhoto(sourceDataUrl: string, targetSize = 164): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sourceWidth = img.naturalWidth || img.width;
      const sourceHeight = img.naturalHeight || img.height;
      if (sourceWidth <= 0 || sourceHeight <= 0) {
        reject(new Error('Could not read Nordic Clean photo dimensions'));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create Nordic Clean photo canvas'));
        return;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, targetSize, targetSize);
      const scale = Math.max(targetSize / sourceWidth, targetSize / sourceHeight);
      const scaledWidth = sourceWidth * scale;
      const scaledHeight = sourceHeight * scale;
      const dx = (targetSize - scaledWidth) / 2;
      const dy = (targetSize - scaledHeight) / 2;
      ctx.drawImage(img, dx, dy, scaledWidth, scaledHeight);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => reject(new Error('Could not load Nordic Clean photo source'));
    img.src = sourceDataUrl;
  });
}

async function prepareExecutivePremiumCanonicalPhoto(cvData: CVData): Promise<ExecutivePremiumCanonicalPhotoResult | null> {
  const showPhoto = cvData.personal.photoEnabled !== undefined
    ? cvData.personal.photoEnabled
    : cvData.region !== 'US';
  if (!showPhoto) return null;

  const personalPhotos = cvData.personal as CVData['personal'] & {
    originalPhoto?: string;
    rectangularPhoto?: string;
  };
  const original = personalPhotos.originalPhoto?.trim();
  if (original) {
    const prepared = await prepareCvPhotoForExport(original);
    if (prepared) {
      const dataUrl = await createExecutivePremiumPortraitPhoto(prepared.dataUrl);
      return {
        dataUrl,
        bytes: dataUrlToBytes(dataUrl),
        mimeType: 'image/jpeg',
        width: 180,
        height: 240,
        source: 'original-photo',
      };
    }
  }

  const rectangular = personalPhotos.rectangularPhoto?.trim();
  if (rectangular) {
    const prepared = await prepareCvPhotoForExport(rectangular);
    if (prepared) {
      try {
        const inspection = await inspectRectangularPhotoDataUrl(prepared.dataUrl);
        if (
          inspection.width > 0
          && inspection.height > 0
          && !inspection.hasAlpha
          && !inspection.hasTransparentCorner
          && !inspection.hasArtificialBlackCorners
          && !inspection.hasArtificialWhiteCorners
        ) {
          const dataUrl = await createExecutivePremiumPortraitPhoto(prepared.dataUrl);
          return {
            dataUrl,
            bytes: dataUrlToBytes(dataUrl),
            mimeType: 'image/jpeg',
            width: 180,
            height: 240,
            source: 'validated-rectangular',
          };
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}

type InlineStyleSnapshot = {
  element: HTMLElement;
  style: string | null;
};

function snapshotInlineStyles(root: HTMLElement): InlineStyleSnapshot[] {
  return [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
    .map((element) => ({ element, style: element.getAttribute('style') }));
}

function restoreInlineStyles(snapshots: InlineStyleSnapshot[]): void {
  for (const { element, style } of snapshots) {
    if (style === null) element.removeAttribute('style');
    else element.setAttribute('style', style);
  }
}

type StyledPdfTemplateId = 'modern-minimal' | 'clean-simple' | 'professional-classic' | 'creative-bold' | 'creative-artistic' | 'elegant-formal' | 'ats-standard' | 'executive-premium' | 'nordic-clean' | 'tech-sidebar' | 'corporate-navy' | 'contemporary-bold' | 'rirekisho';

function isModernMinimalCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'modern-minimal'
    || Boolean(target.querySelector('[data-template-id="modern-minimal"]'));
}

function isCleanSimpleCaptureTarget(target: HTMLElement): boolean {
  // getAttribute is required: some Android WebViews do not mirror data-* onto
  // dataset for off-screen export roots, and querySelector does not match self.
  return target.getAttribute('data-template-id') === 'clean-simple'
    || target.getAttribute('data-export-template') === 'clean-simple'
    || target.dataset.templateId === 'clean-simple'
    || Boolean(target.querySelector('[data-template-id="clean-simple"]'));
}

function isProfessionalClassicCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'professional-classic'
    || Boolean(target.querySelector('[data-template-id="professional-classic"]'));
}

function isCreativeBoldCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'creative-bold'
    || Boolean(target.querySelector('[data-template-id="creative-bold"]'));
}

function isCreativeArtisticCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'creative-artistic'
    || Boolean(target.querySelector('[data-template-id="creative-artistic"]'));
}

function isElegantFormalCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'elegant-formal'
    || Boolean(target.querySelector('[data-template-id="elegant-formal"]'));
}

function isAtsStandardCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'ats-standard'
    || Boolean(target.querySelector('[data-template-id="ats-standard"]'));
}

function isExecutivePremiumCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'executive-premium'
    || Boolean(target.querySelector('[data-template-id="executive-premium"]'));
}

function isNordicCleanCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'nordic-clean'
    || Boolean(target.querySelector('[data-template-id="nordic-clean"]'));
}

function isTechSidebarCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'tech-sidebar'
    || Boolean(target.querySelector('[data-template-id="tech-sidebar"]'));
}

function isCorporateNavyCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'corporate-navy'
    || Boolean(target.querySelector('[data-template-id="corporate-navy"]'));
}

function isContemporaryBoldCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'contemporary-bold'
    || Boolean(target.querySelector('[data-template-id="contemporary-bold"]'));
}

function isRirekishoCaptureTarget(target: HTMLElement): boolean {
  return target.dataset.templateId === 'rirekisho'
    || Boolean(target.querySelector('[data-template-id="rirekisho"]'));
}

function getTemplateCaptureRoot(target: HTMLElement, templateId: StyledPdfTemplateId): HTMLElement | null {
  if (
    target.getAttribute('data-template-id') === templateId
    || target.dataset.templateId === templateId
  ) {
    return target;
  }
  return target.querySelector(`[data-template-id="${templateId}"]`) as HTMLElement | null;
}

function getExportStyleTemplateId(target: HTMLElement): StyledPdfTemplateId | null {
  if (isModernMinimalCaptureTarget(target)) return 'modern-minimal';
  if (isCleanSimpleCaptureTarget(target)) return 'clean-simple';
  if (isProfessionalClassicCaptureTarget(target)) return 'professional-classic';
  if (isCreativeBoldCaptureTarget(target)) return 'creative-bold';
  if (isCreativeArtisticCaptureTarget(target)) return 'creative-artistic';
  if (isElegantFormalCaptureTarget(target)) return 'elegant-formal';
  if (isAtsStandardCaptureTarget(target)) return 'ats-standard';
  if (isExecutivePremiumCaptureTarget(target)) return 'executive-premium';
  if (isNordicCleanCaptureTarget(target)) return 'nordic-clean';
  if (isTechSidebarCaptureTarget(target)) return 'tech-sidebar';
  if (isCorporateNavyCaptureTarget(target)) return 'corporate-navy';
  if (isContemporaryBoldCaptureTarget(target)) return 'contemporary-bold';
  if (isRirekishoCaptureTarget(target)) return 'rirekisho';
  return null;
}

function fallbackModernMinimalColor(element: Element, property: string): string {
  const classes = Array.from(element.classList);
  if (property === 'background-color') {
    if (classes.includes('bg-white')) return '#ffffff';
    if (classes.includes('bg-indigo-50')) return '#eef2ff';
    return 'rgba(0, 0, 0, 0)';
  }
  if (property.startsWith('border')) {
    if (classes.includes('border-indigo-600')) return '#4f46e5';
    if (classes.includes('border-gray-200')) return '#e5e7eb';
    return '#e5e7eb';
  }
  if (classes.includes('text-indigo-600')) return '#4f46e5';
  if (classes.includes('text-indigo-700')) return '#4338ca';
  if (classes.includes('text-gray-900')) return '#111827';
  if (classes.includes('text-gray-700')) return '#374151';
  if (classes.includes('text-gray-600')) return '#4b5563';
  if (classes.includes('text-gray-500')) return '#6b7280';
  if (classes.includes('text-gray-400')) return '#9ca3af';
  return '#111827';
}

function fallbackCleanSimpleColor(element: Element, property: string): string {
  const classes = Array.from(element.classList);
  if (property === 'background-color') {
    if (classes.includes('bg-white')) return '#ffffff';
    if (classes.includes('bg-gray-50')) return '#f9fafb';
    return 'rgba(0, 0, 0, 0)';
  }
  if (property.startsWith('border')) {
    if (classes.includes('border-gray-200')) return '#e5e7eb';
    return '#e5e7eb';
  }
  if (classes.includes('text-emerald-600')) return '#059669';
  if (classes.includes('text-gray-900')) return '#111827';
  if (classes.includes('text-gray-700')) return '#374151';
  if (classes.includes('text-gray-600')) return '#4b5563';
  if (classes.includes('text-gray-500')) return '#6b7280';
  if (classes.includes('text-gray-400')) return '#9ca3af';
  if (classes.includes('text-gray-300')) return '#d1d5db';
  return '#111827';
}

function fallbackProfessionalClassicColor(element: Element, property: string): string {
  const classes = Array.from(element.classList);
  if (property === 'background-color') {
    if (classes.includes('bg-white')) return '#ffffff';
    if (classes.includes('bg-slate-800')) return '#1f2937';
    if (classes.includes('bg-slate-100')) return '#f1f5f9';
    return 'rgba(0, 0, 0, 0)';
  }
  if (property.startsWith('border')) {
    if (classes.includes('border-slate-600')) return '#475569';
    if (classes.includes('border-slate-200')) return '#e2e8f0';
    return '#e2e8f0';
  }
  if (classes.includes('text-white')) return '#ffffff';
  if (classes.includes('text-slate-300')) return '#cbd5e1';
  if (classes.includes('text-slate-400')) return '#94a3b8';
  if (classes.includes('text-slate-500')) return '#64748b';
  if (classes.includes('text-slate-800')) return '#1e293b';
  if (classes.includes('text-gray-900')) return '#111827';
  if (classes.includes('text-gray-700')) return '#374151';
  if (classes.includes('text-gray-600')) return '#4b5563';
  if (classes.includes('text-gray-500')) return '#6b7280';
  if (classes.includes('text-gray-400')) return '#9ca3af';
  return '#111827';
}

function fallbackCreativeBoldColor(element: Element, property: string): string {
  const classes = Array.from(element.classList);
  if (property === 'background-image') return 'none';
  if (property === 'background-color' || property === 'background') {
    if (classes.includes('bg-white')) return '#ffffff';
    if (classes.includes('bg-white/10')) return 'rgba(255, 255, 255, 0.1)';
    if (classes.includes('bg-white/20')) return 'rgba(255, 255, 255, 0.2)';
    if (classes.includes('from-rose-600') || classes.includes('to-pink-700')) return '#be123c';
    return 'rgba(0, 0, 0, 0)';
  }
  if (property.startsWith('border')) {
    if (classes.includes('border-rose-200')) return '#fecdd3';
    if (classes.includes('border-white/50')) return 'rgba(255, 255, 255, 0.5)';
    return '#fecdd3';
  }
  if (property === 'color' && element.closest('.text-rose-100')) return '#ffe4e6';
  if (property === 'color' && element.closest('.text-rose-200')) return '#fecdd3';
  if (classes.includes('text-white')) return '#ffffff';
  if (classes.includes('text-rose-100')) return '#ffe4e6';
  if (classes.includes('text-rose-200')) return '#fecdd3';
  if (classes.includes('text-rose-600')) return '#e11d48';
  if (classes.includes('text-gray-900')) return '#111827';
  if (classes.includes('text-gray-700')) return '#374151';
  if (classes.includes('text-gray-600')) return '#4b5563';
  if (classes.includes('text-gray-500')) return '#6b7280';
  if (property === 'color' && element.closest('aside')) return '#ffffff';
  return '#111827';
}

function fallbackCreativeArtisticColor(element: Element, property: string): string {
  const classes = Array.from(element.classList);
  if (property === 'background-image') {
    if (classes.includes('bg-gradient-to-r') || classes.includes('from-violet-600') || classes.includes('to-fuchsia-600')) {
      return 'linear-gradient(90deg, #7c3aed 0%, #c026d3 100%)';
    }
    return 'none';
  }
  if (property === 'background-color' || property === 'background') {
    if (classes.includes('bg-white')) return '#ffffff';
    if (classes.includes('bg-violet-50')) return '#f5f3ff';
    if (classes.includes('bg-white/20')) return 'rgba(255, 255, 255, 0.2)';
    if (classes.includes('from-violet-600') || classes.includes('to-fuchsia-600')) return '#7c3aed';
    return 'rgba(0, 0, 0, 0)';
  }
  if (property.startsWith('border')) {
    if (classes.includes('border-violet-200')) return '#ddd6fe';
    if (classes.includes('border-white/40')) return 'rgba(255, 255, 255, 0.4)';
    return '#ddd6fe';
  }
  if (classes.includes('text-white')) return '#ffffff';
  if (classes.includes('text-violet-200')) return '#ddd6fe';
  if (classes.includes('text-violet-500')) return '#8b5cf6';
  if (classes.includes('text-violet-600')) return '#7c3aed';
  if (classes.includes('text-violet-700')) return '#6d28d9';
  if (classes.includes('text-gray-900')) return '#111827';
  if (classes.includes('text-gray-700')) return '#374151';
  if (classes.includes('text-gray-600')) return '#4b5563';
  if (classes.includes('text-gray-500')) return '#6b7280';
  if (property === 'color' && element.closest('header')) return '#ffffff';
  return '#111827';
}

function fallbackElegantFormalColor(element: Element, property: string): string {
  const classes = Array.from(element.classList);
  if (property === 'background-color' || property === 'background') {
    if (classes.includes('bg-white')) return '#ffffff';
    return 'rgba(0, 0, 0, 0)';
  }
  if (property.startsWith('border')) {
    if (classes.includes('border-gray-300')) return '#d1d5db';
    if (classes.includes('border-gray-200')) return '#e5e7eb';
    return '#e5e7eb';
  }
  if (classes.includes('text-amber-700')) return '#b45309';
  if (classes.includes('text-gray-900')) return '#111827';
  if (classes.includes('text-gray-800')) return '#1f2937';
  if (classes.includes('text-gray-700')) return '#374151';
  if (classes.includes('text-gray-600')) return '#4b5563';
  if (classes.includes('text-gray-500')) return '#6b7280';
  if (classes.includes('text-gray-400')) return '#9ca3af';
  return '#111827';
}

function fallbackExportColor(element: Element, property: string, templateId: StyledPdfTemplateId): string {
  if (templateId === 'clean-simple') return fallbackCleanSimpleColor(element, property);
  if (templateId === 'professional-classic') return fallbackProfessionalClassicColor(element, property);
  if (templateId === 'creative-bold') return fallbackCreativeBoldColor(element, property);
  if (templateId === 'creative-artistic') return fallbackCreativeArtisticColor(element, property);
  if (templateId === 'elegant-formal') return fallbackElegantFormalColor(element, property);
  if (templateId === 'ats-standard') return fallbackProfessionalClassicColor(element, property);
  if (templateId === 'executive-premium') return fallbackProfessionalClassicColor(element, property);
  if (templateId === 'nordic-clean') return fallbackCleanSimpleColor(element, property);
  if (templateId === 'tech-sidebar') return fallbackProfessionalClassicColor(element, property);
  if (templateId === 'corporate-navy') return fallbackProfessionalClassicColor(element, property);
  if (templateId === 'contemporary-bold') return fallbackProfessionalClassicColor(element, property);
  if (templateId === 'rirekisho') return fallbackProfessionalClassicColor(element, property);
  return fallbackModernMinimalColor(element, property);
}

function copyTemplateComputedStyles(sourceRoot: HTMLElement, cloneRoot: HTMLElement, templateId: StyledPdfTemplateId): void {
  const sourceElements = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll('*'))];
  const cloneElements = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll('*'))] as HTMLElement[];

  sourceElements.forEach((sourceEl, index) => {
    const cloneEl = cloneElements[index];
    if (!cloneEl) return;

    const computed = window.getComputedStyle(sourceEl);
    for (const property of computed) {
      let value = computed.getPropertyValue(property);
      if (/\b(?:lab|lch|oklab|oklch)\(/i.test(value)) {
        value = fallbackExportColor(sourceEl, property, templateId);
      }
      if (
        (templateId === 'creative-bold' || templateId === 'creative-artistic')
        && property === 'background-image'
        && /\b(?:lab|lch|oklab|oklch)\(/i.test(value)
      ) {
        value = fallbackExportColor(sourceEl, property, templateId);
      }
      cloneEl.style.setProperty(property, value, computed.getPropertyPriority(property));
    }

    if (sourceEl instanceof HTMLImageElement && cloneEl instanceof HTMLImageElement) {
      cloneEl.alt = '';
      cloneEl.style.width = '100%';
      cloneEl.style.height = '100%';
      cloneEl.style.objectFit = 'cover';
      cloneEl.style.display = 'block';
    }
  });
}

const PROFESSIONAL_CLASSIC_PDF_FONT_STACK = 'Arial, Helvetica, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, sans-serif';
const CREATIVE_BOLD_PDF_FONT_STACK = 'Arial, Helvetica, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, sans-serif';
const CREATIVE_ARTISTIC_PDF_FONT_STACK = 'Arial, Helvetica, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, sans-serif';
const ELEGANT_FORMAL_PDF_FONT_STACK = 'Georgia, "Times New Roman", Times, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, serif';
const CREATIVE_BOLD_PDF_SIDEBAR_PERCENT = 28;
const CREATIVE_BOLD_PDF_MAIN_PERCENT = 100 - CREATIVE_BOLD_PDF_SIDEBAR_PERCENT;
const PDF_PAGE_INTERSECTION_EPSILON_PX = 0.5;
const CREATIVE_ARTISTIC_GROUP_PAGE_PADDING_PX = 0.5;
const CREATIVE_ARTISTIC_MAX_KEEP_GROUP_PAGE_RATIO = 0.9;
// Work Experience entries are handled separately from the whole-block education-section/
// skills-block groups above: a long entry (title + many description lines) must stay
// split-friendly, so a much lower ratio is used here — see the header/line comment on
// applyCreativeArtisticKeepTogetherPagination for the full rationale (same reasoning
// already proven for creative-bold's CREATIVE_BOLD_MAX_KEEP_GROUP_PAGE_RATIO).
const CREATIVE_ARTISTIC_EXPERIENCE_MAX_KEEP_GROUP_PAGE_RATIO = 0.62;
// If Education+Skills alone would land on a fresh trailing page filling less than this
// fraction of the page, that page reads as "mostly empty" — pull the immediately
// preceding Work Experience entry onto the same page instead (see the trailing-balance
// check in applyCreativeArtisticKeepTogetherPagination) so the final page looks
// intentional rather than like a near-blank afterthought.
const CREATIVE_ARTISTIC_TRAILING_PAGE_MIN_FILL_RATIO = 0.55;
// Pulling the last Work Experience entry forward always relocates exactly that entry's
// own height from the bottom of the *previous* page to the trailing page — the previous
// page's blank space grows by precisely the amount the trailing page's fill improves
// (moving content never destroys or creates blank space, it only redistributes it). So
// "pull the entry" must never be applied unconditionally: it is only a genuine
// improvement when the blank space it *creates* on the previous page is smaller than the
// blank space it *removes* from the trailing page, and even then only up to a hard cap —
// beyond this fraction of a page, a "huge blank gap" on the previous page is worse than a
// sparse trailing page, so natural pagination (Education+Skills moved alone, without the
// entry) is preferred instead.
const CREATIVE_ARTISTIC_TRAILING_PAGE_MAX_PULL_GAP_RATIO = 0.3;
// Creative Artistic still uses generic html2canvas capture + fixed-height slicing.
// Without baked continuation padding and whitespace-aware breaks, page 1 summary rows
// sit flush to the bottom edge and page 2 continuation starts too tight / with ghosts.
const CREATIVE_ARTISTIC_PDF_PAGE_TOP_INSET_CSS_PX = 28;
const CREATIVE_ARTISTIC_PDF_PAGE_BOTTOM_INSET_CSS_PX = 28;
const CREATIVE_ARTISTIC_PDF_PAGE_BREAK_SEARCH_RANGE_CSS_PX = 96;
const CREATIVE_ARTISTIC_PDF_PAGE_BREAK_MIN_BAND_CSS_PX = 6;
const CREATIVE_ARTISTIC_PDF_CONTENT_GUARD_CSS_PX = 24;
const ELEGANT_FORMAL_GROUP_PAGE_PADDING_PX = 0.5;
const ELEGANT_FORMAL_MAX_KEEP_GROUP_PAGE_RATIO = 0.9;
// Break-selection guard: keep page cuts out of glyph bands without aggressively
// shortening every page (large values here caused extra PDF pages on Android).
const ELEGANT_FORMAL_PAGE_BREAK_GUARD_PX = 16;
// Visual insets for PDF slice placement — separate from break-selection guard.
// Baked into continuation-page slice bitmaps so Android PDF viewers show real top
// breathing room (jsPDF y-offset alone is unreliable when slices are scaled).
const ELEGANT_FORMAL_PDF_PAGE_TOP_INSET_CSS_PX = 28;
const ELEGANT_FORMAL_PDF_PAGE_BOTTOM_INSET_CSS_PX = 28;
// ATS Standard uses the same baked-padding PDF slice model as Elegant Formal.
const ATS_STANDARD_PDF_PAGE_TOP_INSET_CSS_PX = 28;
const ATS_STANDARD_PDF_PAGE_BOTTOM_INSET_CSS_PX = 28;
// Executive Premium uses the same baked-padding PDF slice model.
const EXECUTIVE_PREMIUM_PDF_PAGE_TOP_INSET_CSS_PX = 28;
const EXECUTIVE_PREMIUM_PDF_PAGE_BOTTOM_INSET_CSS_PX = 28;
// Nordic Clean uses the same baked-padding PDF slice model.
const NORDIC_CLEAN_PDF_PAGE_TOP_INSET_CSS_PX = 28;
const NORDIC_CLEAN_PDF_PAGE_BOTTOM_INSET_CSS_PX = 28;
// Tech Sidebar uses the same baked-padding PDF slice model.
const TECH_SIDEBAR_PDF_PAGE_TOP_INSET_CSS_PX = 28;
const TECH_SIDEBAR_PDF_PAGE_BOTTOM_INSET_CSS_PX = 28;
// Modern Minimal uses generic fixed-height slicing after keep-together; continuation pages
// need baked top padding so section headings are not flush to the PDF page edge.
const MODERN_MINIMAL_PDF_PAGE_TOP_INSET_CSS_PX = 28;
const MODERN_MINIMAL_PDF_PAGE_BOTTOM_INSET_CSS_PX = 0;
// Creative Bold still uses the generic html2canvas capture, but its red sidebar is
// non-white on every row. Page-break ink checks must therefore scan only the white
// main column, then render with baked padding to prevent boundary glyph ghosts.
const CREATIVE_BOLD_PDF_PAGE_TOP_INSET_CSS_PX = 28;
const CREATIVE_BOLD_PDF_PAGE_BOTTOM_INSET_CSS_PX = 28;
const CREATIVE_BOLD_PDF_PAGE_BREAK_SEARCH_RANGE_CSS_PX = 84;
const CREATIVE_BOLD_PDF_PAGE_BREAK_MIN_BAND_CSS_PX = 6;
const CREATIVE_BOLD_PDF_MAIN_COLUMN_GUARD_CSS_PX = 14;
// Clean Simple uses the same generic fixed-height slicing model; continuation summary text
// was flush to the PDF top edge without baked continuation-page padding.
// V6: 56px baked top whitespace measured ~14-15mm on Android viewers — visually too
// large once real block-aware pagination stopped continuation pages from starting
// mid-sentence. V7: 42px still measured slightly too large ("1-2 lines" ask) — 34px
// targets the middle of the requested 32-36px band.
const CLEAN_SIMPLE_PDF_PAGE_TOP_INSET_CSS_PX = 34;
// V6: previously 0 — the safe-break search could fall back to a break within a few
// canvas px of the true page bottom with no margin for error, and (see the slice
// planner below) the planned break height didn't even account for the top inset that
// would later shrink the same page's usable content, so the render step silently
// cropped already-planned content off the bottom of the slice instead of deferring it
// to the next page. A real reserved bottom band, now fed into slice planning itself,
// guarantees no source pixel is ever assigned to the last N px of a page.
// V7: 28px still wasn't enough margin for error on real Android WebView rasterization
// (JPEG compression + anti-aliasing can make a glyph's edge pixels look "safe enough"
// to a pixel-only scan) — 40px targets the middle of the requested 36-44px band, and is
// now paired with a real per-rendered-text-line DOM safe-break search (see
// `collectElegantFormalTextLineIntervalsCss` usage below) instead of relying on pixel
// scanning alone.
const CLEAN_SIMPLE_PDF_PAGE_BOTTOM_INSET_CSS_PX = 40;
const CLEAN_SIMPLE_PDF_HORIZONTAL_PADDING_CSS_PX = 32;
const CLEAN_SIMPLE_PAGE_BREAK_GUARD_PX = 8;
const CLEAN_SIMPLE_CANVAS_PAGE_BREAK_SEARCH_RANGE_PX = 128;
// V7: search range (in CSS px, scaled to canvas px at call time) for the DOM/real-text-
// line-based safe break search — mirrors Elegant Formal's line-interval search, which
// replaces guessing a safe row from rasterized canvas pixels with the actual rendered
// line boxes of the Clean Simple template (measured via Range.getClientRects()).
const CLEAN_SIMPLE_DOM_PAGE_BREAK_SEARCH_RANGE_PX = 64;
// V9: after a line-safe break, nudge the source-crop boundary a few canvas px past the
// previous text line's measured bottom so anti-aliased/descender pixels from that row are
// not included in the next page's slice — the ghost specks above page-2 text.
const CLEAN_SIMPLE_POST_LINE_BREAK_GUARD_CSS_PX = 3;
// V11: FINAL AUTHORITY for every Clean Simple page boundary is the actual captured
// html2canvas bitmap, not DOM measurements taken before capture — real Android WebView
// rasterization can shift glyph rows by a few px relative to what Range.getClientRects()
// reported pre-capture, which is exactly what let V10's DOM-verified "safe" break still
// land inside real rendered ink (a text row split across page 1/page 2). Require a band
// of this many consecutive zero-ink canvas rows (scaled by capture DPI) before accepting
// a break inside it; degrades to a thinner real gap only when a full-width band truly
// doesn't exist (tight line-height), but never accepts a break inside an ink row.
const CLEAN_SIMPLE_CANVAS_WHITESPACE_MIN_BAND_CSS_PX = 6;
// Strict near-white threshold: any channel below this counts as ink. Deliberately much
// closer to 255 than Elegant Formal's 248 (and checked on every pixel, not a sampled
// subset) so faint anti-aliased glyph edges can never be misread as clean whitespace.
const CLEAN_SIMPLE_CANVAS_INK_NEAR_WHITE_THRESHOLD = 250;
const CLEAN_SIMPLE_CANVAS_INK_ALPHA_THRESHOLD = 4;
const CLEAN_SIMPLE_GROUP_PAGE_PADDING_PX = 2;
// A keep-group (heading + first entry, or a whole experience/education entry) is only
// ever moved to a fresh page wholesale when it is short enough to actually fit there —
// otherwise shifting it just recreates the same overflow one page later.
const CLEAN_SIMPLE_MAX_KEEP_GROUP_PAGE_RATIO = 0.62;
// "Keep with next" for Work Experience: the section heading must stay glued to at least
// the first entry's title/company/date row plus this many lines of its description, not
// just the bare heading — otherwise a heading can "safely" (no clipped glyph) land alone
// at the bottom of a page while its first entry starts the next page with no heading.
const CLEAN_SIMPLE_EXPERIENCE_REQUIRED_TRAILING_LINES = 2;
// Same "keep with next" idea for the Professional Summary heading, bounded to a couple
// of lines rather than the whole (now unsplit, potentially very long) summary
// paragraph — otherwise a long summary would make the heading "require" nearly a full
// page of trailing room and get shifted away from its own body text unnecessarily.
const CLEAN_SIMPLE_SUMMARY_REQUIRED_TRAILING_LINES = 2;
/**
 * Historical build-tag constant, kept only for tests/diagnostics that want to tag a PDF
 * build explicitly via `BuildCvPdfBlobOptions.pdfBuildCanary`. V11: production Clean
 * Simple exports (`getCleanSimplePdfExportBuildOptions`) no longer embed this in real
 * output PDF metadata — no canary-only success claims.
 */
export const CLEAN_SIMPLE_PDF_BUILD_CANARY = 'CLEAN_SIMPLE_CANVAS_PIXEL_FINAL_V11';
// Safe page-break selection for Tech Sidebar — scan/cut only the main column, not the dark sidebar.
const TECH_SIDEBAR_PAGE_BREAK_GUARD_PX = 16;
const TECH_SIDEBAR_PAGE_BREAK_SEARCH_RANGE_PX = 48;
const TECH_SIDEBAR_CANVAS_PAGE_BREAK_SEARCH_RANGE_PX = 96;
const TECH_SIDEBAR_SIDEBAR_WIDTH_MM = 64;
// Rirekisho uses table-heavy tall-canvas slicing; continuation pages need baked padding and
// safe source breaks that ignore thin table-border ink at row edges.
const RIREKISHO_PDF_PAGE_TOP_INSET_CSS_PX = 28;
const RIREKISHO_PDF_PAGE_BOTTOM_INSET_CSS_PX = 0;
const RIREKISHO_PAGE_BREAK_GUARD_PX = 16;
const RIREKISHO_PAGE_BREAK_SEARCH_RANGE_PX = 48;
const RIREKISHO_CANVAS_PAGE_BREAK_SEARCH_RANGE_PX = 96;
const RIREKISHO_PDF_HORIZONTAL_PADDING_CSS_PX = 34;
const RIREKISHO_CANVAS_CONTENT_SAMPLE_INSET_RATIO = 0.08;
const RIREKISHO_GROUP_PAGE_PADDING_PX = 0.5;
const RIREKISHO_MAX_KEEP_GROUP_PAGE_RATIO = 0.62;
const RIREKISHO_EXPERIENCE_MAX_KEEP_UNIT_PAGE_RATIO = 0.9;
// Self PR is one tall table cell; keep only the heading plus the first couple of lines
// together — the body may split across pages via safe canvas slicing.
const RIREKISHO_SELF_PR_MAX_KEEP_LINES = 2;
// If the final PDF page would be mostly empty tail (Education/Skills/Languages only),
// merge it with the previous page instead of emitting a sparse trailing page.
const ELEGANT_FORMAL_TRAILING_TAIL_SPARSE_RATIO = 0.35;
// How far above a nominal page cut to search for whitespace between text rows when
// choosing a safe canvas slice boundary (line-level, not block-level).
const ELEGANT_FORMAL_PAGE_BREAK_SEARCH_RANGE_PX = 48;
// Canvas-pixel fallback search band for Android WebView where DOM line boxes are often
// block-level or missing — inspect the rendered html2canvas bitmap directly.
const ELEGANT_FORMAL_CANVAS_PAGE_BREAK_SEARCH_RANGE_PX = 96;
const ELEGANT_FORMAL_CANVAS_INK_MAX_CHANNEL = 248;
const ELEGANT_FORMAL_DOM_LINE_MAX_HEIGHT_CSS_PX = 40;
// Experience entries can be long; only short atomic units (header row, bullet line) or
// genuinely short whole entries should ever be pushed wholesale — same ratio as creative-bold.
const ELEGANT_FORMAL_EXPERIENCE_MAX_KEEP_GROUP_PAGE_RATIO = 0.62;
// Professional Classic previously had zero keep-together logic (pure fixed-height
// canvas slicing), which could cut a section heading or a single experience/education
// entry in half at a page boundary. A deliberately lower ratio than the 0.9 used by
// elegant-formal/creative-artistic is used here — only genuinely short blocks (a single
// entry, or a heading + short section) are ever pushed to the next page, so this can
// only ever close a small gap at the bottom of a page, never manufacture a large one by
// relocating a big multi-entry block.
const PROFESSIONAL_CLASSIC_GROUP_PAGE_PADDING_PX = 0.5;
const PROFESSIONAL_CLASSIC_MAX_KEEP_GROUP_PAGE_RATIO = 0.62;
const CREATIVE_BOLD_GROUP_PAGE_PADDING_PX = 0.5;
const CREATIVE_BOLD_MAX_KEEP_GROUP_PAGE_RATIO = 0.62;
// Corporate Navy uses fixed-height canvas slicing with no prior keep-together pass, which
// let section headings (especially WORK EXPERIENCE) land alone at a page bottom while
// their first content block started on the next page.
const CORPORATE_NAVY_GROUP_PAGE_PADDING_PX = 0.5;
const CORPORATE_NAVY_MAX_KEEP_GROUP_PAGE_RATIO = 0.62;
const CORPORATE_NAVY_EXPERIENCE_MAX_KEEP_UNIT_PAGE_RATIO = 0.9;
const MODERN_MINIMAL_GROUP_PAGE_PADDING_PX = 0.5;
const MODERN_MINIMAL_MAX_KEEP_GROUP_PAGE_RATIO = 0.62;
const MODERN_MINIMAL_EXPERIENCE_MAX_KEEP_UNIT_PAGE_RATIO = 0.9;
// Visual-polish-only tuning for a trailing page that ends up containing nothing but the
// closing Education/Skills+Languages/Certifications blocks (see
// applyProfessionalClassicFinalPageBalance below). None of these affect a page that has
// other content on it, and none of them fire at all for a single-page document.
const PROFESSIONAL_CLASSIC_FINAL_PAGE_SPARSE_RATIO = 0.55;
const PROFESSIONAL_CLASSIC_FINAL_PAGE_MAX_LEAD_PX = 24;
const PROFESSIONAL_CLASSIC_FINAL_PAGE_TOP_BREATHING_PX = 40;
const PROFESSIONAL_CLASSIC_FINAL_SECTION_GAP_EXTRA_PX = 7;
const PROFESSIONAL_CLASSIC_FINAL_CHIP_GAP_EXTRA_PX = 3;

type MeaningfulContentIntervalCss = {
  topCssPx: number;
  bottomCssPx: number;
};

type MeaningfulContentBounds = {
  rootWidthCssPx: number;
  rootHeightCssPx: number;
  maxBottomCssPx: number;
  intervals: MeaningfulContentIntervalCss[];
};

type MeaningfulContentPagePlan = {
  scalePxPerCssPx: number;
  maxBottomCanvasPx: number;
  intervals: Array<{ topPx: number; bottomPx: number }>;
};

const SEMANTIC_CANVAS_BOTTOM_PADDING_PX = 16;

function normalizeProfessionalClassicPdfTextStyles(root: HTMLElement): void {
  normalizePdfTextStyles(root, PROFESSIONAL_CLASSIC_PDF_FONT_STACK);
}

function normalizeCreativeBoldPdfTextStyles(root: HTMLElement): void {
  normalizePdfTextStyles(root, CREATIVE_BOLD_PDF_FONT_STACK);
}

function normalizeCreativeArtisticPdfTextStyles(root: HTMLElement): void {
  normalizePdfTextStyles(root, CREATIVE_ARTISTIC_PDF_FONT_STACK);
}

function normalizeElegantFormalPdfTextStyles(root: HTMLElement): void {
  normalizePdfTextStyles(root, ELEGANT_FORMAL_PDF_FONT_STACK);
}

function applyElegantFormalPdfNoWrapItems(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-export-contact-row="elegant-formal"]').forEach((row) => {
    row.style.setProperty('display', 'flex');
    row.style.setProperty('flex-wrap', 'wrap');
    row.style.setProperty('justify-content', 'center');
    row.style.setProperty('align-items', 'center');
    row.style.setProperty('gap', '0');
  });

  root.querySelectorAll<HTMLElement>('[data-export-contact-item="elegant-formal"]').forEach((item) => {
    item.style.setProperty('display', 'inline-flex');
    item.style.setProperty('align-items', 'center');
    item.style.setProperty('white-space', 'nowrap');
    item.style.setProperty('flex', '0 0 auto');
    item.style.setProperty('flex-shrink', '0');
    item.style.setProperty('word-break', 'keep-all');
    item.style.setProperty('overflow-wrap', 'normal');
  });

  root.querySelectorAll<HTMLElement>('[data-export-contact-item="elegant-formal"] span, [data-export-contact-separator="elegant-formal"]').forEach((itemPart) => {
    itemPart.style.setProperty('display', 'inline-block');
    itemPart.style.setProperty('white-space', 'nowrap');
    itemPart.style.setProperty('flex-shrink', '0');
    itemPart.style.setProperty('word-break', 'keep-all');
    itemPart.style.setProperty('overflow-wrap', 'normal');
  });

  root.querySelectorAll<HTMLElement>('[data-export-skill-row="elegant-formal"], [data-export-language-row="elegant-formal"], [data-export-certification-row="elegant-formal"]').forEach((row) => {
    row.style.setProperty('display', 'flex');
    row.style.setProperty('flex-wrap', 'wrap');
    row.style.setProperty('justify-content', 'center');
    row.style.setProperty('align-items', 'center');
    row.style.setProperty('gap', '4px 10px');
    row.style.setProperty('line-height', '1.3');
  });

  root.querySelectorAll<HTMLElement>('[data-export-skill-chip="elegant-formal"], [data-export-language-row="elegant-formal"] span, [data-export-certification-row="elegant-formal"] span').forEach((item) => {
    item.style.setProperty('display', 'inline-flex');
    item.style.setProperty('white-space', 'nowrap');
    item.style.setProperty('flex', '0 0 auto');
    item.style.setProperty('flex-shrink', '0');
    item.style.setProperty('word-break', 'keep-all');
    item.style.setProperty('overflow-wrap', 'normal');
  });

  root.querySelectorAll<HTMLElement>('[data-export-bullet-list="elegant-formal"]').forEach((list) => {
    list.style.setProperty('display', 'block');
    list.style.setProperty('list-style-type', 'disc');
    list.style.setProperty('list-style-position', 'outside');
    list.style.setProperty('padding-left', '18px');
    list.style.setProperty('margin', '4px 0 0');
  });

  root.querySelectorAll<HTMLElement>('[data-export-bullet-item="elegant-formal"]').forEach((item) => {
    item.style.setProperty('display', 'list-item');
    item.style.setProperty('margin', '0 0 3px');
    item.style.setProperty('padding-left', '2px');
    item.style.setProperty('white-space', 'normal');
    item.style.setProperty('line-height', '1.32');
  });
}

function applyCreativeArtisticPdfNoWrapItems(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-export-contact-row="creative-artistic"]').forEach((row) => {
    row.style.setProperty('display', 'flex');
    row.style.setProperty('flex-wrap', 'wrap');
    row.style.setProperty('align-items', 'center');
  });

  root.querySelectorAll<HTMLElement>('[data-export-contact-item="true"]').forEach((item) => {
    item.style.setProperty('display', 'inline-flex');
    item.style.setProperty('align-items', 'center');
    item.style.setProperty('white-space', 'nowrap');
    item.style.setProperty('flex', '0 0 auto');
    item.style.setProperty('flex-shrink', '0');
    item.style.setProperty('width', 'max-content');
    item.style.setProperty('max-width', '100%');
    item.style.setProperty('word-break', 'keep-all');
    item.style.setProperty('overflow-wrap', 'normal');
  });

  root.querySelectorAll<HTMLElement>('[data-export-contact-item="true"] span, [data-export-contact-separator="true"]').forEach((itemPart) => {
    itemPart.style.setProperty('display', 'inline-block');
    itemPart.style.setProperty('white-space', 'nowrap');
    itemPart.style.setProperty('flex-shrink', '0');
    itemPart.style.setProperty('word-break', 'keep-all');
    itemPart.style.setProperty('overflow-wrap', 'normal');
  });

  root.querySelectorAll<HTMLElement>('[data-export-group="skills-row"]').forEach((row) => {
    row.style.setProperty('display', 'flex');
    row.style.setProperty('flex-wrap', 'wrap');
    row.style.setProperty('align-items', 'flex-start');
  });

  root.querySelectorAll<HTMLElement>('[data-export-skill-chip="true"]').forEach((chip) => {
    chip.style.setProperty('display', 'inline-flex');
    chip.style.setProperty('align-items', 'center');
    chip.style.setProperty('white-space', 'nowrap');
    chip.style.setProperty('flex', '0 0 auto');
    chip.style.setProperty('flex-shrink', '0');
    chip.style.setProperty('width', 'max-content');
    chip.style.setProperty('max-width', '100%');
    chip.style.setProperty('word-break', 'keep-all');
    chip.style.setProperty('overflow-wrap', 'normal');
  });
}

function applyCreativeBoldPdfLayout(root: HTMLElement): void {
  const layout = root.firstElementChild as HTMLElement | null;
  const sidebar = root.querySelector('aside') as HTMLElement | null;
  const main = root.querySelector('main') as HTMLElement | null;
  if (!layout || !sidebar || !main) return;

  root.style.setProperty('width', '210mm');
  root.style.setProperty('min-width', '210mm');
  root.style.setProperty('max-width', '210mm');
  root.style.setProperty('box-sizing', 'border-box');
  root.style.setProperty('overflow', 'hidden');
  root.style.setProperty('background-color', '#ffffff');

  layout.style.setProperty('display', 'grid');
  layout.style.setProperty('grid-template-columns', `${CREATIVE_BOLD_PDF_SIDEBAR_PERCENT}% ${CREATIVE_BOLD_PDF_MAIN_PERCENT}%`);
  layout.style.setProperty('width', '100%');
  layout.style.setProperty('max-width', '100%');
  layout.style.setProperty('box-sizing', 'border-box');
  layout.style.setProperty('gap', '0');
  layout.style.setProperty('align-items', 'stretch');
  layout.style.setProperty('overflow', 'hidden');

  sidebar.style.setProperty('grid-column', '1');
  sidebar.style.setProperty('width', '100%');
  sidebar.style.setProperty('min-width', '0');
  sidebar.style.setProperty('max-width', 'none');
  sidebar.style.setProperty('flex', '0 0 auto');
  sidebar.style.setProperty('box-sizing', 'border-box');
  sidebar.style.setProperty('overflow', 'hidden');
  sidebar.style.setProperty('background', 'linear-gradient(180deg, #e11d48 0%, #be123c 100%)');
  sidebar.style.setProperty('background-color', '#be123c');

  main.style.setProperty('grid-column', '2');
  main.style.setProperty('width', '100%');
  main.style.setProperty('min-width', '0');
  main.style.setProperty('max-width', 'none');
  main.style.setProperty('box-sizing', 'border-box');
  main.style.setProperty('overflow-x', 'hidden');
  main.style.setProperty('background-color', '#ffffff');

  const firstExperienceEntry = main.querySelector<HTMLElement>('[data-export-group="creative-bold-experience-entry"]');
  const experienceSection = firstExperienceEntry?.closest('section') as HTMLElement | null;
  const experienceHeading = experienceSection?.querySelector<HTMLElement>('h2') ?? null;
  if (experienceHeading) {
    experienceHeading.setAttribute('data-export-group', 'creative-bold-experience-section-heading');
  }

  const educationSection = main.querySelector<HTMLElement>('[data-export-group="creative-bold-education-section"]');
  const educationHeading = educationSection?.querySelector<HTMLElement>('h2') ?? null;
  const educationEntry = educationSection?.querySelector<HTMLElement>('div[data-export-meaningful="true"]') ?? null;
  if (educationHeading) {
    educationHeading.setAttribute('data-export-group', 'creative-bold-education-heading');
  }
  if (educationEntry) {
    educationEntry.setAttribute('data-export-group', 'creative-bold-education-entry');
  }
}

function applyElegantFormalPdfLayout(root: HTMLElement): void {
  const header = root.querySelector('header') as HTMLElement | null;
  const photoFrame = root.querySelector('[data-elegant-formal-photo="frame"]') as HTMLElement | null;
  const bottomGrid = root.querySelector('[data-export-group="skills-languages-block"]') as HTMLElement | null;

  root.style.setProperty('width', '210mm');
  root.style.setProperty('min-width', '210mm');
  root.style.setProperty('max-width', '210mm');
  root.style.setProperty('box-sizing', 'border-box');
  root.style.setProperty('overflow-x', 'hidden');
  root.style.setProperty('overflow-y', 'visible');
  root.style.setProperty('background-color', '#ffffff');
  root.style.setProperty('color', '#111827');
  root.style.setProperty('padding', '34px');
  root.style.setProperty('font-size', '13px');
  root.style.setProperty('line-height', '1.42');

  if (header) {
    header.style.setProperty('box-sizing', 'border-box');
    header.style.setProperty('border-bottom', '1px solid #d1d5db');
    header.style.setProperty('padding-bottom', '16px');
    header.style.setProperty('margin-bottom', '16px');
    header.style.setProperty('background-color', '#ffffff');
  }

  if (photoFrame) {
    photoFrame.style.setProperty('width', `${ELEGANT_FORMAL_PHOTO_WIDTH}px`);
    photoFrame.style.setProperty('height', `${ELEGANT_FORMAL_PHOTO_HEIGHT}px`);
    photoFrame.style.setProperty('min-width', `${ELEGANT_FORMAL_PHOTO_WIDTH}px`);
    photoFrame.style.setProperty('flex', `0 0 ${ELEGANT_FORMAL_PHOTO_WIDTH}px`);
    photoFrame.style.setProperty('overflow', 'hidden');
    photoFrame.style.setProperty('border-radius', '2px');
    photoFrame.style.setProperty('border', '0 solid transparent');
    photoFrame.style.setProperty('background-color', 'transparent');
    photoFrame.style.setProperty('box-sizing', 'border-box');
    const photo = photoFrame.querySelector('img') as HTMLImageElement | null;
    if (photo) {
      photo.style.setProperty('width', '100%');
      photo.style.setProperty('height', '100%');
      photo.style.setProperty('object-fit', 'cover');
      photo.style.setProperty('object-position', '50% 35%');
      photo.style.setProperty('display', 'block');
      photo.style.setProperty('border-radius', '2px');
      photo.style.setProperty('clip-path', 'none');
      photo.style.setProperty('mask-image', 'none');
      photo.style.setProperty('-webkit-mask-image', 'none');
    }
  }

  if (bottomGrid) {
    bottomGrid.style.setProperty('display', 'grid');
    bottomGrid.style.setProperty('grid-template-columns', '1.65fr 0.7fr 0.8fr');
    bottomGrid.style.setProperty('gap', '14px');
    bottomGrid.style.setProperty('text-align', 'center');
    bottomGrid.style.setProperty('border-top', '1px solid #e5e7eb');
    bottomGrid.style.setProperty('padding-top', '9px');
    bottomGrid.style.setProperty('box-sizing', 'border-box');
  }

  root.querySelectorAll<HTMLElement>('[data-elegant-formal-entry-row="true"]').forEach((row) => {
    row.style.setProperty('display', 'grid');
    row.style.setProperty('grid-template-columns', 'minmax(0, 1fr) auto');
    row.style.setProperty('align-items', 'baseline');
    row.style.setProperty('column-gap', '16px');
    row.style.setProperty('width', '100%');
    row.style.setProperty('box-sizing', 'border-box');
  });

  root.querySelectorAll<HTMLElement>('[data-elegant-formal-entry-row="true"] h3').forEach((heading) => {
    heading.style.setProperty('min-width', '0');
    heading.style.setProperty('line-height', '1.25');
    heading.style.setProperty('margin', '0');
  });

  root.querySelectorAll<HTMLElement>('[data-export-group="experience-entry"] > p:first-of-type').forEach((company) => {
    company.style.setProperty('margin', '4px 0 0');
    company.style.setProperty('line-height', '1.25');
  });

  root.querySelectorAll<HTMLElement>('[data-export-bullet-item="elegant-formal"]').forEach((item) => {
    item.style.setProperty('margin', '0 0 2px');
    item.style.setProperty('line-height', '1.24');
  });
}

function applyCreativeArtisticPdfLayout(root: HTMLElement): void {
  const header = root.querySelector('header') as HTMLElement | null;
  const body = header?.nextElementSibling as HTMLElement | null;
  const photoFrame = header?.querySelector('img')?.parentElement as HTMLElement | null;
  if (!header || !body) return;

  root.style.setProperty('width', '210mm');
  root.style.setProperty('min-width', '210mm');
  root.style.setProperty('max-width', '210mm');
  root.style.setProperty('box-sizing', 'border-box');
  root.style.setProperty('overflow-x', 'hidden');
  root.style.setProperty('overflow-y', 'visible');
  root.style.setProperty('background-color', '#ffffff');
  root.style.setProperty('color', '#111827');

  header.style.setProperty('box-sizing', 'border-box');
  header.style.setProperty('padding', '32px');
  header.style.setProperty('background', 'linear-gradient(90deg, #7c3aed 0%, #c026d3 100%)');
  header.style.setProperty('background-color', '#7c3aed');
  header.style.setProperty('color', '#ffffff');

  body.style.setProperty('box-sizing', 'border-box');
  body.style.setProperty('padding', '32px');
  body.style.setProperty('background-color', '#ffffff');
  body.style.setProperty('color', '#111827');

  if (photoFrame) {
    photoFrame.style.setProperty('width', '100px');
    photoFrame.style.setProperty('height', '100px');
    photoFrame.style.setProperty('min-width', '100px');
    photoFrame.style.setProperty('flex', '0 0 100px');
    photoFrame.style.setProperty('border-radius', '9999px');
    photoFrame.style.setProperty('overflow', 'hidden');
    photoFrame.style.setProperty('border', '2px solid rgba(255, 255, 255, 0.4)');
    photoFrame.style.setProperty('background-color', 'rgba(255, 255, 255, 0.2)');
    photoFrame.style.setProperty('box-sizing', 'border-box');
  }
}

function getRelativeOffsetRect(root: HTMLElement, element: HTMLElement): { top: number; bottom: number; height: number } | null {
  if (!root.contains(element)) return null;
  const height = element.offsetHeight;
  if (height <= 0) return null;

  let top = 0;
  let current: HTMLElement | null = element;
  while (current && current !== root) {
    top += current.offsetTop;
    current = current.offsetParent as HTMLElement | null;
  }
  if (current !== root) {
    top = 0;
    current = element;
    while (current && current !== root) {
      top += current.offsetTop;
      current = current.parentElement;
    }
    if (current !== root) return null;
  }

  const bottom = top + height;
  if (bottom <= top) return null;
  return { top, bottom, height: bottom - top };
}

function getRelativeExportRect(
  rootBox: { top: number },
  element: HTMLElement,
  rootElement: HTMLElement | null = null,
): { top: number; bottom: number; height: number } | null {
  const rect = getPositiveRect(element.getBoundingClientRect(), element);
  if (rect && rect.height > PDF_PAGE_INTERSECTION_EPSILON_PX) {
    const top = rect.top - rootBox.top;
    const bottom = rect.bottom - rootBox.top;
    if (bottom > top) return { top, bottom, height: bottom - top };
  }

  if (!rootElement) return null;
  return getRelativeOffsetRect(rootElement, element);
}

function parseCssPx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shiftGroupToNextPage(group: HTMLElement, shiftPx: number): void {
  const currentInlineMargin = parseCssPx(group.style.marginTop);
  group.style.setProperty('margin-top', `${currentInlineMargin + shiftPx}px`);
}

type CreativeArtisticTailBalanceAnchor = {
  element: HTMLElement;
  contentEndBeforePx: number;
};

// Collect Work Experience break anchors near the document tail: whole entries (last
// and previous) plus individual description lines on those entries. Each anchor is a
// safe bullet/paragraph boundary — never mid-line.
function collectCreativeArtisticTailBalanceAnchors(
  entries: HTMLElement[],
  root: HTMLElement,
  rootBox: { top: number },
): CreativeArtisticTailBalanceAnchor[] {
  const anchors: CreativeArtisticTailBalanceAnchor[] = [];
  const firstEntryIndex = Math.max(0, entries.length - 3);

  for (let entryIndex = entries.length - 1; entryIndex >= firstEntryIndex; entryIndex -= 1) {
    const entry = entries[entryIndex];
    const entryRect = getRelativeExportRect(rootBox, entry, root);
    if (!entryRect) continue;

    const previousEntry = entryIndex > 0 ? entries[entryIndex - 1] : null;
    const previousEntryRect = previousEntry ? getRelativeExportRect(rootBox, previousEntry, root) : null;
    anchors.push({
      element: entry,
      contentEndBeforePx: previousEntryRect ? previousEntryRect.bottom : entryRect.top,
    });

    const lines = Array.from(entry.querySelectorAll<HTMLElement>('[data-export-group="creative-artistic-experience-line"]'));
    for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex -= 1) {
      const line = lines[lineIndex];
      const lineRect = getRelativeExportRect(rootBox, line, root);
      if (!lineRect) continue;

      let contentEndBeforePx = lineRect.top;
      if (lineIndex > 0) {
        const previousLineRect = getRelativeExportRect(rootBox, lines[lineIndex - 1], root);
        if (previousLineRect) contentEndBeforePx = previousLineRect.bottom;
      } else {
        const header = entry.querySelector<HTMLElement>('[data-export-group="creative-artistic-experience-header"]');
        const headerRect = header ? getRelativeExportRect(rootBox, header, root) : null;
        if (headerRect) contentEndBeforePx = headerRect.bottom;
      }

      anchors.push({ element: line, contentEndBeforePx });
    }
  }

  return anchors;
}

type CreativeArtisticTailBalanceChoice = {
  anchor: CreativeArtisticTailBalanceAnchor;
  shiftPx: number;
  totalDamage: number;
};

// When Education+Skills alone would occupy a sparse trailing page, evaluate every tail
// anchor and relocate only the candidate that minimizes combined previous-page and
// trailing-page blank damage while keeping the pulled span plus Education+Skills on
// one page.
export function chooseCreativeArtisticTailBalancePull(
  entries: HTMLElement[],
  root: HTMLElement,
  rootBox: { top: number },
  pageHeightCssPx: number,
  maxShortGroupHeight: number,
  eduRect: { top: number; bottom: number },
  skillsRect: { bottom: number },
  trailingBlankWithoutPull: number,
): CreativeArtisticTailBalanceChoice | null {
  if (entries.length === 0) return null;

  const targetPageTop = Math.floor((eduRect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx) * pageHeightCssPx;
  let best: CreativeArtisticTailBalanceChoice | null = null;

  for (const anchor of collectCreativeArtisticTailBalanceAnchors(entries, root, rootBox)) {
    const anchorRect = getRelativeExportRect(rootBox, anchor.element, root);
    if (!anchorRect) continue;

    const combinedWithAnchorHeight = skillsRect.bottom - anchorRect.top;
    const shiftPx = Math.max(0, targetPageTop - anchorRect.top + CREATIVE_ARTISTIC_GROUP_PAGE_PADDING_PX);
    if (
      combinedWithAnchorHeight <= 0
      || combinedWithAnchorHeight >= maxShortGroupHeight
      || shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX
    ) {
      continue;
    }

    const pullAffectsPageIndex = Math.floor((anchor.contentEndBeforePx + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const pullAffectsPageBottom = (pullAffectsPageIndex + 1) * pageHeightCssPx;
    const previousBlankAfterPull = Math.max(0, pullAffectsPageBottom - anchor.contentEndBeforePx);
    const previousBlankRatio = previousBlankAfterPull / pageHeightCssPx;
    const finalFillWithPull = combinedWithAnchorHeight / pageHeightCssPx;
    const trailingBlankWithPull = Math.max(0, 1 - finalFillWithPull);
    const totalDamageWithPull = previousBlankRatio + trailingBlankWithPull;
    const pullWithinGapCap = previousBlankRatio <= CREATIVE_ARTISTIC_TRAILING_PAGE_MAX_PULL_GAP_RATIO;
    const pullImprovesLayout = totalDamageWithPull < trailingBlankWithoutPull;

    if (!pullWithinGapCap || !pullImprovesLayout) continue;

    if (!best || totalDamageWithPull < best.totalDamage) {
      best = { anchor, shiftPx, totalDamage: totalDamageWithPull };
    }
  }

  return best;
}

// Work Experience previously had no keep-together protection at all in Creative
// Artistic's dedicated PDF template — only education-section/skills-block (both always
// short, whole-block-safe) were ever shifted. That left each experience entry's header
// and description lines free to be sliced mid-glyph by a page boundary, and — worse —
// gave no way to stop a long entry that starts near a page boundary from looking broken.
// This mirrors the exact fix already proven for creative-bold: the header (title +
// company/date, `creative-artistic-experience-header`) is only pushed to the next page
// if it would itself be sliced by the boundary, OR if there is no room left on the
// current page for at least one real description line to follow it (avoiding an orphan
// heading alone at the bottom of a page); each description line
// (`creative-artistic-experience-line`) is its own atomic "never slice this" unit, so a
// later line straddling a boundary nudges only that line (and whatever follows), never
// the whole entry. Net effect: a long entry can start on the current page with its
// header plus at least one content line instead of the entire entry jumping wholesale to
// the next page and stranding a blank gap under the previous section — the same problem
// pattern a whole-block ratio would otherwise reproduce for entries under that ratio.
export function applyCreativeArtisticKeepTogetherPagination(root: HTMLElement): void {
  // Android WebView can defer layout for the off-screen export root until forced.
  void root.offsetHeight;
  const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
  const rootWidth = rootRect?.width || root.offsetWidth || root.scrollWidth;
  if (rootWidth <= 0) return;

  const rootBox = { top: rootRect?.top ?? 0 };
  const pageHeightCssPx = rootWidth * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return;

  const groupSelectors = [
    '[data-export-group="education-section"]',
    '[data-export-group="skills-block"]',
  ].join(',');

  const maxShortGroupHeight = pageHeightCssPx * CREATIVE_ARTISTIC_MAX_KEEP_GROUP_PAGE_RATIO;
  const maxShortExperienceHeight = pageHeightCssPx * CREATIVE_ARTISTIC_EXPERIENCE_MAX_KEEP_GROUP_PAGE_RATIO;

  const shiftIfStraddling = (el: HTMLElement): boolean => {
    const rect = getRelativeExportRect(rootBox, el, root);
    if (!rect || rect.height <= 0 || rect.height >= maxShortExperienceHeight) return false;

    const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    if (startsOnPage === endsOnPage) return false;

    const nextPageTop = (startsOnPage + 1) * pageHeightCssPx;
    const shiftPx = Math.max(0, nextPageTop - rect.top + CREATIVE_ARTISTIC_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    shiftGroupToNextPage(el, shiftPx);
    return true;
  };

  const shiftHeaderIfNeeded = (header: HTMLElement, firstLineHeight: number | null): boolean => {
    const rect = getRelativeExportRect(rootBox, header, root);
    if (!rect || rect.height <= 0 || rect.height >= maxShortExperienceHeight) return false;

    const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const headerItselfStraddles = startsOnPage !== endsOnPage;

    const pageBottom = (startsOnPage + 1) * pageHeightCssPx;
    const roomAfterHeader = pageBottom - rect.bottom;
    const wouldOrphanHeading = firstLineHeight !== null && roomAfterHeader < firstLineHeight;

    if (!headerItselfStraddles && !wouldOrphanHeading) return false;

    const shiftPx = Math.max(0, pageBottom - rect.top + CREATIVE_ARTISTIC_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    shiftGroupToNextPage(header, shiftPx);
    return true;
  };

  for (let pass = 0; pass < 8; pass += 1) {
    let movedAnyGroup = false;

    const entries = Array.from(root.querySelectorAll<HTMLElement>('[data-export-group="creative-artistic-experience"]'));

    // The "Work Experience" section heading (h2, marked data-export-keep-with-next by
    // creative-artistic-pdf-template.ts) previously had zero pagination protection at
    // all — only the whole-block education-section/skills-block groups and each entry's
    // own header/lines were ever considered. That let the heading land alone at the
    // bottom of a page while the first entry (title + meta + bullet) started on the
    // next page: a section heading orphaned exactly like the per-entry headers already
    // guard against. Checked first in every pass so the shift (and the normal document
    // flow it pushes the first entry into) is already reflected before that entry's own
    // header/line checks below run in this same pass.
    const firstEntry = entries[0] ?? null;
    if (firstEntry) {
      const sectionEl = firstEntry.parentElement;
      const heading = sectionEl?.querySelector<HTMLElement>('h2') ?? null;
      const firstHeader = firstEntry.querySelector<HTMLElement>('[data-export-group="creative-artistic-experience-header"]');
      if (heading && firstHeader && sectionEl?.firstElementChild === heading) {
        const firstHeaderRect = getRelativeExportRect(rootBox, firstHeader, root);
        const firstLines = Array.from(firstEntry.querySelectorAll<HTMLElement>('[data-export-group="creative-artistic-experience-line"]'));
        const firstLineRect = firstLines.length > 0 ? getRelativeExportRect(rootBox, firstLines[0], root) : null;
        const requiredTrailingHeight = (firstHeaderRect ? firstHeaderRect.height : 0) + (firstLineRect ? firstLineRect.height : 0);
        if (shiftHeaderIfNeeded(heading, requiredTrailingHeight)) movedAnyGroup = true;
      }
    }

    for (const entry of entries) {
      const header = entry.querySelector<HTMLElement>('[data-export-group="creative-artistic-experience-header"]');
      const lines = Array.from(entry.querySelectorAll<HTMLElement>('[data-export-group="creative-artistic-experience-line"]'));

      if (header) {
        const firstLineRect = lines.length > 0 ? getRelativeExportRect(rootBox, lines[0], root) : null;
        if (shiftHeaderIfNeeded(header, firstLineRect ? firstLineRect.height : null)) movedAnyGroup = true;
      }

      for (const line of lines) {
        if (shiftIfStraddling(line)) movedAnyGroup = true;
      }
    }

    // Education and Skills were previously evaluated as two independent whole-groups
    // below: if Education already fit at the bottom of a page but the Skills block
    // that immediately follows it did not, only Skills got pushed to the very top of
    // the next page — stranding it alone there with a large blank area beneath while
    // Education stayed behind on the earlier page. Checking the combined
    // Education-start -> Skills-end span first means both move together whenever they
    // don't both fit on the current page (and neither moves when they already do), so
    // the final page is never "Skills only". That alone can still leave a *mostly
    // empty* trailing page (Education+Skills together, but only filling a small
    // fraction of the page) whenever Work Experience happens to end almost exactly at
    // a page boundary — especially when Languages/Certifications are absent and the
    // trailing tail is even shorter. The old fix only tried pulling the *whole* last
    // Work Experience entry, which either failed the fit/damage checks or left a huge
    // blank gap on the previous page. Instead, evaluate several safe tail anchors
    // (last entry, previous entry, individual bullet lines near the end) and pull only
    // the candidate that genuinely improves total layout damage.
    const educationSection = root.querySelector<HTMLElement>('[data-export-group="education-section"]');
    const skillsBlockEl = root.querySelector<HTMLElement>('[data-export-group="skills-block"]');
    if (educationSection && skillsBlockEl) {
      const eduRect = getRelativeExportRect(rootBox, educationSection, root);
      const skillsRect = getRelativeExportRect(rootBox, skillsBlockEl, root);
      if (eduRect && skillsRect && skillsRect.bottom > eduRect.top) {
        const combinedHeight = skillsRect.bottom - eduRect.top;
        if (combinedHeight > 0 && combinedHeight < maxShortGroupHeight) {
          const startsOnPage = Math.floor((eduRect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
          const endsOnPage = Math.floor((skillsRect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
          const fillRatio = combinedHeight / pageHeightCssPx;
          const trailingBlankWithoutPull = Math.max(0, 1 - fillRatio);
          const isSparseTrailingPage = fillRatio < CREATIVE_ARTISTIC_TRAILING_PAGE_MIN_FILL_RATIO;
          const isStraddling = startsOnPage !== endsOnPage;
          let pulledTailAnchor = false;

          if (isSparseTrailingPage && entries.length > 0) {
            const pullChoice = chooseCreativeArtisticTailBalancePull(
              entries,
              root,
              rootBox,
              pageHeightCssPx,
              maxShortGroupHeight,
              eduRect,
              skillsRect,
              trailingBlankWithoutPull,
            );
            if (pullChoice) {
              shiftGroupToNextPage(pullChoice.anchor.element, pullChoice.shiftPx);
              root.setAttribute('data-ca-tail-balance-applied', 'true');
              movedAnyGroup = true;
              pulledTailAnchor = true;
            }
          }

          if (isStraddling && !pulledTailAnchor) {
            const nextPageTop = (startsOnPage + 1) * pageHeightCssPx;
            const shiftPx = Math.max(0, nextPageTop - eduRect.top + CREATIVE_ARTISTIC_GROUP_PAGE_PADDING_PX);
            if (shiftPx > PDF_PAGE_INTERSECTION_EPSILON_PX) {
              shiftGroupToNextPage(educationSection, shiftPx);
              movedAnyGroup = true;
            }
          }
        }
      }
    }

    const wholeGroups = Array.from(root.querySelectorAll<HTMLElement>(groupSelectors));
    for (const group of wholeGroups) {
      const rect = getRelativeExportRect(rootBox, group, root);
      if (!rect || rect.height <= 0 || rect.height >= maxShortGroupHeight) continue;

      const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
      const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
      if (startsOnPage === endsOnPage) continue;

      const nextPageTop = (startsOnPage + 1) * pageHeightCssPx;
      const shiftPx = Math.max(0, nextPageTop - rect.top + CREATIVE_ARTISTIC_GROUP_PAGE_PADDING_PX);
      if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) continue;

      shiftGroupToNextPage(group, shiftPx);
      movedAnyGroup = true;
    }
    if (!movedAnyGroup) break;
  }
}

// Elegant Formal previously only shifted whole short blocks when they straddled a page
// boundary (experience-entry, education-section). Section h2 headings (Work Experience,
// Education, Skills) had no orphan protection at all, so a heading could land alone at
// the bottom of a page while its first entry/chip row started on the next page. Skills
// was not even in the whole-block list, so the Skills heading could orphan with chips
// clipped or stranded on the following page. This mirrors creative-bold/creative-artistic:
// shift section headings only when there is insufficient room for the first content block,
// shift entry title rows when the first bullet would orphan, and treat each bullet as an
// atomic unit — never relocate a long entry wholesale.
function computeElegantFormalPageBoundaryShiftPx(
  rect: { top: number; bottom: number },
  pageHeightCssPx: number,
): number | null {
  const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
  const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
  const pageTop = startsOnPage * pageHeightCssPx;
  const pageBottom = (startsOnPage + 1) * pageHeightCssPx;

  const straddles = startsOnPage !== endsOnPage;
  const tooCloseToBottom = startsOnPage === endsOnPage
    && (pageBottom - rect.bottom) < ELEGANT_FORMAL_PAGE_BREAK_GUARD_PX;
  const tooCloseToTop = startsOnPage > 0
    && (rect.top - pageTop) < ELEGANT_FORMAL_PAGE_BREAK_GUARD_PX;

  if (!straddles && !tooCloseToBottom && !tooCloseToTop) return null;

  const targetTop = (straddles || tooCloseToBottom)
    ? pageBottom + ELEGANT_FORMAL_PAGE_BREAK_GUARD_PX
    : pageTop + ELEGANT_FORMAL_PAGE_BREAK_GUARD_PX;
  const shiftPx = targetTop - rect.top + ELEGANT_FORMAL_GROUP_PAGE_PADDING_PX;
  return shiftPx > PDF_PAGE_INTERSECTION_EPSILON_PX ? shiftPx : null;
}

export function applyElegantFormalKeepTogetherPagination(root: HTMLElement): void {
  void root.offsetHeight;
  const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
  const rootWidth = rootRect?.width || root.offsetWidth || root.scrollWidth;
  if (rootWidth <= 0) return;

  const rootBox = { top: rootRect?.top ?? 0 };
  const pageHeightCssPx = rootWidth * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return;

  const groupSelectors = [
    '[data-export-group="experience-entry"]',
    '[data-export-group="education-section"]',
  ].join(',');

  const maxShortGroupHeight = pageHeightCssPx * ELEGANT_FORMAL_MAX_KEEP_GROUP_PAGE_RATIO;
  const maxShortExperienceHeight = pageHeightCssPx * ELEGANT_FORMAL_EXPERIENCE_MAX_KEEP_GROUP_PAGE_RATIO;

  const shiftAtomicBlockForPageBoundary = (
    el: HTMLElement,
    maxHeight = maxShortExperienceHeight,
  ): boolean => {
    const rect = getRelativeExportRect(rootBox, el, root);
    if (!rect || rect.height <= 0 || rect.height >= maxHeight) return false;

    const shiftPx = computeElegantFormalPageBoundaryShiftPx(rect, pageHeightCssPx);
    if (shiftPx === null) return false;

    shiftGroupToNextPage(el, shiftPx);
    return true;
  };

  const shiftWholeGroupIfStraddling = (el: HTMLElement, maxHeight: number): boolean => {
    const rect = getRelativeExportRect(rootBox, el, root);
    if (!rect || rect.height <= 0 || rect.height >= maxHeight) return false;

    const shiftPx = computeElegantFormalPageBoundaryShiftPx(rect, pageHeightCssPx);
    if (shiftPx === null) return false;

    shiftGroupToNextPage(el, shiftPx);
    return true;
  };

  const shiftHeaderIfNeeded = (
    header: HTMLElement,
    firstLineHeight: number | null,
    maxHeight = maxShortExperienceHeight,
  ): boolean => {
    const rect = getRelativeExportRect(rootBox, header, root);
    if (!rect || rect.height <= 0 || rect.height >= maxHeight) return false;

    const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const headerItselfStraddles = startsOnPage !== endsOnPage;

    const pageBottom = (startsOnPage + 1) * pageHeightCssPx;
    const roomAfterHeader = pageBottom - rect.bottom;
    const requiredTrailingHeight = (firstLineHeight ?? 0) + ELEGANT_FORMAL_PAGE_BREAK_GUARD_PX;
    const wouldOrphanHeading = firstLineHeight !== null && roomAfterHeader < requiredTrailingHeight;

    if (!headerItselfStraddles && !wouldOrphanHeading) return false;

    const shiftPx = Math.max(
      0,
      pageBottom + ELEGANT_FORMAL_PAGE_BREAK_GUARD_PX - rect.top + ELEGANT_FORMAL_GROUP_PAGE_PADDING_PX,
    );
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    shiftGroupToNextPage(header, shiftPx);
    return true;
  };

  const lowerSectionRowSelectors = [
    '[data-export-skill-row="elegant-formal"]',
    '[data-export-language-row="elegant-formal"]',
    '[data-export-certification-row="elegant-formal"]',
  ].join(',');

  const atomicBoundarySelectors = [
    '[data-export-bullet-item="elegant-formal"]',
    '[data-export-group="summary-section"] p[data-export-meaningful="true"]',
    '[data-export-group="experience-entry"] [data-elegant-formal-entry-row="true"]',
    '[data-export-group="experience-entry"] > p',
    '[data-export-group="education-entry"]',
    '[data-export-skill-row="elegant-formal"]',
    '[data-export-language-row="elegant-formal"]',
    '[data-export-certification-row="elegant-formal"]',
  ].join(',');

  for (let pass = 0; pass < 8; pass += 1) {
    let movedAnyGroup = false;

    const expEntries = Array.from(root.querySelectorAll<HTMLElement>('[data-export-group="experience-entry"]'));
    const firstExpEntry = expEntries[0] ?? null;
    if (firstExpEntry) {
      const expSection = firstExpEntry.closest<HTMLElement>('[data-export-group="experience-section"]');
      const heading = expSection?.querySelector<HTMLElement>('h2') ?? null;
      if (heading && expSection?.firstElementChild === heading) {
        const entryRow = firstExpEntry.querySelector<HTMLElement>('[data-elegant-formal-entry-row="true"]');
        const company = firstExpEntry.querySelector<HTMLElement>('p');
        const firstBullet = firstExpEntry.querySelector<HTMLElement>('[data-export-bullet-item="elegant-formal"]');
        const entryRowRect = entryRow ? getRelativeExportRect(rootBox, entryRow, root) : null;
        const companyRect = company ? getRelativeExportRect(rootBox, company, root) : null;
        const bulletRect = firstBullet ? getRelativeExportRect(rootBox, firstBullet, root) : null;
        const requiredTrailingHeight =
          (entryRowRect?.height ?? 0) + (companyRect?.height ?? 0) + (bulletRect?.height ?? 0);
        if (
          requiredTrailingHeight > 0
          && shiftHeaderIfNeeded(heading, requiredTrailingHeight, maxShortGroupHeight)
        ) {
          movedAnyGroup = true;
        }
      }
    }

    for (const entry of expEntries) {
      const entryRow = entry.querySelector<HTMLElement>('[data-elegant-formal-entry-row="true"]');
      const company = entry.querySelector<HTMLElement>('p');
      const bullets = Array.from(entry.querySelectorAll<HTMLElement>('[data-export-bullet-item="elegant-formal"]'));

      if (entryRow && bullets.length > 0) {
        const companyRect = company ? getRelativeExportRect(rootBox, company, root) : null;
        const firstBulletRect = getRelativeExportRect(rootBox, bullets[0], root);
        const requiredAfterRow = (companyRect?.height ?? 0) + (firstBulletRect?.height ?? 0);
        if (shiftHeaderIfNeeded(entryRow, requiredAfterRow)) movedAnyGroup = true;
      } else if (entryRow && company) {
        const companyRect = getRelativeExportRect(rootBox, company, root);
        if (shiftHeaderIfNeeded(entryRow, companyRect?.height ?? null)) movedAnyGroup = true;
      }
    }

    const eduSection = root.querySelector<HTMLElement>('[data-export-group="education-section"]');
    if (eduSection) {
      const heading = eduSection.querySelector<HTMLElement>('h2');
      const firstEduEntry = eduSection.querySelector<HTMLElement>('[data-export-group="education-entry"]');
      if (heading && firstEduEntry && eduSection.firstElementChild === heading) {
        const entryRect = getRelativeExportRect(rootBox, firstEduEntry, root);
        if (entryRect && shiftHeaderIfNeeded(heading, entryRect.height, maxShortGroupHeight)) {
          movedAnyGroup = true;
        }
      }
    }

    for (const section of Array.from(root.querySelectorAll<HTMLElement>(
      '[data-export-group="skills-section"],[data-export-group="languages-section"],[data-export-group="certifications-section"]',
    ))) {
      const heading = section.querySelector<HTMLElement>('h2');
      const row = section.querySelector<HTMLElement>(lowerSectionRowSelectors);
      if (heading && row && section.firstElementChild === heading) {
        const rowRect = getRelativeExportRect(rootBox, row, root);
        if (rowRect && shiftHeaderIfNeeded(heading, rowRect.height, maxShortGroupHeight)) {
          movedAnyGroup = true;
        }
      }
    }

    for (const block of Array.from(root.querySelectorAll<HTMLElement>(atomicBoundarySelectors))) {
      const maxHeight = block.matches('[data-export-group="education-entry"]')
        ? maxShortGroupHeight
        : maxShortExperienceHeight;
      if (shiftAtomicBlockForPageBoundary(block, maxHeight)) movedAnyGroup = true;
    }

    const groups = Array.from(root.querySelectorAll<HTMLElement>(groupSelectors));
    for (const group of groups) {
      const maxHeight = group.getAttribute('data-export-group') === 'education-section'
        ? maxShortGroupHeight
        : maxShortExperienceHeight;
      if (shiftWholeGroupIfStraddling(group, maxHeight)) movedAnyGroup = true;
    }

    const educationSection = root.querySelector<HTMLElement>('[data-export-group="education-section"]');
    const skillsLanguagesBlock = root.querySelector<HTMLElement>('[data-export-group="skills-languages-block"]');
    if (educationSection && skillsLanguagesBlock) {
      const eduRect = getRelativeExportRect(rootBox, educationSection, root);
      const skillsRect = getRelativeExportRect(rootBox, skillsLanguagesBlock, root);
      if (eduRect && skillsRect && skillsRect.bottom > eduRect.top) {
        const combinedHeight = skillsRect.bottom - eduRect.top;
        if (combinedHeight > 0 && combinedHeight < maxShortGroupHeight) {
          const startsOnPage = Math.floor((eduRect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
          const endsOnPage = Math.floor((skillsRect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
          if (startsOnPage !== endsOnPage) {
            const nextPageTop = (startsOnPage + 1) * pageHeightCssPx;
            const shiftPx = Math.max(0, nextPageTop - eduRect.top + ELEGANT_FORMAL_GROUP_PAGE_PADDING_PX);
            if (shiftPx > PDF_PAGE_INTERSECTION_EPSILON_PX) {
              shiftGroupToNextPage(educationSection, shiftPx);
              movedAnyGroup = true;
            }
          }
        }
      }
    }

    if (!movedAnyGroup) break;
  }
}

export type ElegantFormalTextLineIntervalCss = {
  topCssPx: number;
  bottomCssPx: number;
};

function mergeElegantFormalTextLineIntervals(
  intervals: ElegantFormalTextLineIntervalCss[],
): ElegantFormalTextLineIntervalCss[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.topCssPx - b.topCssPx || a.bottomCssPx - b.bottomCssPx);
  const merged: ElegantFormalTextLineIntervalCss[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (
      last
      && interval.topCssPx - last.bottomCssPx < 4
      && Math.abs(interval.topCssPx - last.topCssPx) < 4
    ) {
      last.topCssPx = Math.min(last.topCssPx, interval.topCssPx);
      last.bottomCssPx = Math.max(last.bottomCssPx, interval.bottomCssPx);
    } else {
      merged.push({ topCssPx: interval.topCssPx, bottomCssPx: interval.bottomCssPx });
    }
  }
  return merged;
}

// Measure every rendered text line in the Elegant Formal export root using Range/
// getClientRects so long wrapped paragraphs (e.g. Professional Summary) expose
// individual line boxes — block-level keep-together alone cannot protect these.
export function collectElegantFormalTextLineIntervalsCss(root: HTMLElement): ElegantFormalTextLineIntervalCss[] {
  void root.offsetHeight;
  const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
  if (!rootRect) return [];

  const rootTop = rootRect.top;
  const intervals: ElegantFormalTextLineIntervalCss[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;

  while (node) {
    const text = node.textContent ?? '';
    if (!text.trim()) {
      node = walker.nextNode() as Text | null;
      continue;
    }

    const parentEl = node.parentElement;
    if (!parentEl) {
      node = walker.nextNode() as Text | null;
      continue;
    }

    const range = document.createRange();
    range.selectNodeContents(node);
    let rects: DOMRect[] = [];
    if (typeof range.getClientRects === 'function') {
      rects = Array.from(range.getClientRects());
    }
    if (rects.length === 0) {
      const fallbackRect = getRelativeExportRect({ top: rootTop }, parentEl, root);
      if (fallbackRect && fallbackRect.height > PDF_PAGE_INTERSECTION_EPSILON_PX) {
        intervals.push({ topCssPx: fallbackRect.top, bottomCssPx: fallbackRect.bottom });
      }
    } else {
      for (const rect of rects) {
        if (rect.width <= 0 || rect.height <= PDF_PAGE_INTERSECTION_EPSILON_PX) continue;
        const topCssPx = rect.top - rootTop;
        const bottomCssPx = rect.bottom - rootTop;
        if (bottomCssPx > topCssPx) intervals.push({ topCssPx, bottomCssPx });
      }
    }

    node = walker.nextNode() as Text | null;
  }

  return mergeElegantFormalTextLineIntervals(intervals);
}

export function scaleElegantFormalTextLineIntervalsToCanvas(
  intervals: ElegantFormalTextLineIntervalCss[],
  scalePxPerCssPx: number,
): Array<{ top: number; bottom: number }> {
  if (scalePxPerCssPx <= 0) return [];
  return intervals.map(interval => ({
    top: interval.topCssPx * scalePxPerCssPx,
    bottom: interval.bottomCssPx * scalePxPerCssPx,
  }));
}

export function isUnsafeElegantFormalPageBreakCanvasPx(
  breakPx: number,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }>,
  guardPx: number,
): boolean {
  const sorted = [...lineIntervalsCanvasPx].sort((a, b) => a.top - b.top || a.bottom - b.bottom);

  for (const line of sorted) {
    if (breakPx > line.top + PDF_PAGE_INTERSECTION_EPSILON_PX && breakPx < line.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) {
      return true;
    }
  }

  let previousLine: { top: number; bottom: number } | null = null;
  let nextLine: { top: number; bottom: number } | null = null;
  for (const line of sorted) {
    if (line.bottom <= breakPx + PDF_PAGE_INTERSECTION_EPSILON_PX) previousLine = line;
    if (line.top >= breakPx - PDF_PAGE_INTERSECTION_EPSILON_PX && !nextLine) {
      nextLine = line;
      break;
    }
  }

  const gapPx = previousLine && nextLine ? nextLine.top - previousLine.bottom : null;
  const effectiveGuardPx = gapPx !== null && gapPx > 0
    ? Math.min(guardPx, gapPx / 2)
    : guardPx;

  if (previousLine && breakPx - previousLine.bottom < effectiveGuardPx) return true;
  if (nextLine && nextLine.top - breakPx < effectiveGuardPx) return true;
  return false;
}

// Pick a canvas Y near the nominal page cut that falls in whitespace between text
// rows instead of slicing through a glyph band.
export function findSafeElegantFormalPageBreakCanvasPx(
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }>,
  targetBreakPx: number,
  guardPx: number,
  searchRangePx: number,
): number {
  if (lineIntervalsCanvasPx.length === 0) return Math.floor(targetBreakPx);

  const minBreakPx = Math.max(0, targetBreakPx - searchRangePx);
  const maxBreakPx = targetBreakPx + Math.min(searchRangePx * 0.5, guardPx * 2);

  for (let candidate = Math.floor(targetBreakPx); candidate >= minBreakPx; candidate -= 1) {
    if (!isUnsafeElegantFormalPageBreakCanvasPx(candidate, lineIntervalsCanvasPx, guardPx)) return candidate;
  }
  for (let candidate = Math.floor(targetBreakPx) + 1; candidate <= maxBreakPx; candidate += 1) {
    if (!isUnsafeElegantFormalPageBreakCanvasPx(candidate, lineIntervalsCanvasPx, guardPx)) return candidate;
  }

  return Math.floor(targetBreakPx);
}

export function areElegantFormalDomLineIntervalsReliable(
  intervalsCss: ElegantFormalTextLineIntervalCss[],
): boolean {
  if (intervalsCss.length === 0) return false;
  const tallLineCount = intervalsCss.filter(
    interval => (interval.bottomCssPx - interval.topCssPx) > ELEGANT_FORMAL_DOM_LINE_MAX_HEIGHT_CSS_PX,
  ).length;
  return tallLineCount / intervalsCss.length < 0.34;
}

function isElegantFormalCanvasPixelInk(red: number, green: number, blue: number, alpha: number): boolean {
  if (alpha <= 0) return false;
  return red < ELEGANT_FORMAL_CANVAS_INK_MAX_CHANNEL
    || green < ELEGANT_FORMAL_CANVAS_INK_MAX_CHANNEL
    || blue < ELEGANT_FORMAL_CANVAS_INK_MAX_CHANNEL;
}

function analyzeElegantFormalCanvasWhitespaceRows(
  canvas: HTMLCanvasElement,
  startY: number,
  endY: number,
  contentLeftPx: number,
  contentRightPx: number,
): boolean[] {
  const top = Math.max(0, Math.floor(startY));
  const bottom = Math.min(canvas.height - 1, Math.floor(endY));
  if (bottom < top) return [];

  const left = Math.max(0, Math.floor(contentLeftPx));
  const right = Math.min(canvas.width, Math.ceil(contentRightPx));
  const bandWidth = Math.max(1, right - left);
  const bandHeight = bottom - top + 1;
  const ctx = canvas.getContext('2d');
  if (!ctx || bandHeight <= 0) return Array.from({ length: Math.max(0, bandHeight) }, () => true);

  const sampleStep = Math.max(2, Math.floor(bandWidth / 120));
  const data = ctx.getImageData(left, top, bandWidth, bandHeight).data;
  const rowIsWhitespace: boolean[] = [];

  for (let row = 0; row < bandHeight; row += 1) {
    let darkSamples = 0;
    let sampleCount = 0;
    for (let x = 0; x < bandWidth; x += sampleStep) {
      sampleCount += 1;
      const index = (row * bandWidth + x) * 4;
      if (isElegantFormalCanvasPixelInk(data[index], data[index + 1], data[index + 2], data[index + 3])) {
        darkSamples += 1;
      }
    }
    rowIsWhitespace.push(sampleCount === 0 || darkSamples / sampleCount < 0.025);
  }

  return rowIsWhitespace;
}

export function isElegantFormalCanvasBreakRowWhitespace(
  canvas: HTMLCanvasElement,
  breakPx: number,
  contentLeftPx: number,
  contentRightPx: number,
): boolean {
  const rows = analyzeElegantFormalCanvasWhitespaceRows(
    canvas,
    breakPx,
    breakPx,
    contentLeftPx,
    contentRightPx,
  );
  return rows.length === 0 || rows[0] === true;
}

function distanceToNearestInkRowInBand(
  rowIsWhitespace: boolean[],
  rowIndex: number,
  direction: -1 | 1,
): number {
  let distance = 0;
  for (
    let index = rowIndex + direction;
    index >= 0 && index < rowIsWhitespace.length;
    index += direction
  ) {
    distance += 1;
    if (!rowIsWhitespace[index]) return distance;
  }
  return -1;
}

// Inspect html2canvas pixels around a nominal page cut to find a horizontal whitespace
// band that avoids slicing through rendered glyph pixels.
export function findSafeElegantFormalPageBreakFromCanvasPixels(
  canvas: HTMLCanvasElement,
  targetBreakPx: number,
  guardPx: number,
  searchRangePx: number,
  minBreakPx: number,
  contentLeftPx: number,
  contentRightPx: number,
): number {
  const nominalBreakPx = Math.floor(targetBreakPx);
  const searchStartPx = Math.max(0, Math.floor(minBreakPx + 1));
  const searchEndPx = Math.min(
    canvas.height - 1,
    Math.floor(nominalBreakPx + Math.min(searchRangePx * 0.25, guardPx * 2)),
  );
  const bandStartPx = Math.max(searchStartPx, nominalBreakPx - searchRangePx);
  const rowIsWhitespace = analyzeElegantFormalCanvasWhitespaceRows(
    canvas,
    bandStartPx,
    searchEndPx,
    contentLeftPx,
    contentRightPx,
  );
  if (rowIsWhitespace.length === 0) return nominalBreakPx;

  let bestBreakPx = nominalBreakPx;
  let bestDistancePx = Infinity;

  for (let rowIndex = rowIsWhitespace.length - 1; rowIndex >= 0; rowIndex -= 1) {
    if (!rowIsWhitespace[rowIndex]) continue;

    let runTopIndex = rowIndex;
    let runBottomIndex = rowIndex;
    while (runTopIndex > 0 && rowIsWhitespace[runTopIndex - 1]) runTopIndex -= 1;
    while (runBottomIndex < rowIsWhitespace.length - 1 && rowIsWhitespace[runBottomIndex + 1]) {
      runBottomIndex += 1;
    }

    const candidateBreakPx = bandStartPx + rowIndex;
    if (candidateBreakPx <= minBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX) continue;

    const inkAbovePx = distanceToNearestInkRowInBand(rowIsWhitespace, rowIndex, -1);
    const inkBelowPx = distanceToNearestInkRowInBand(rowIsWhitespace, rowIndex, 1);
    const gapPx = runBottomIndex - runTopIndex + 1;
    const effectiveGuardPx = gapPx > 0 ? Math.min(guardPx, gapPx / 2) : guardPx;

    if (inkAbovePx >= 0 && inkAbovePx < effectiveGuardPx) continue;
    if (inkBelowPx >= 0 && inkBelowPx < effectiveGuardPx) continue;

    const distanceFromNominalPx = Math.abs(nominalBreakPx - candidateBreakPx);
    if (
      distanceFromNominalPx < bestDistancePx
      || (distanceFromNominalPx === bestDistancePx && candidateBreakPx > bestBreakPx)
    ) {
      bestDistancePx = distanceFromNominalPx;
      bestBreakPx = candidateBreakPx;
    }
  }

  if (bestDistancePx < Infinity) return bestBreakPx;

  for (let rowIndex = rowIsWhitespace.length - 1; rowIndex >= 0; rowIndex -= 1) {
    if (!rowIsWhitespace[rowIndex]) continue;
    const candidateBreakPx = bandStartPx + rowIndex;
    if (candidateBreakPx <= minBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX) continue;
    return candidateBreakPx;
  }

  return nominalBreakPx;
}

export type ElegantFormalPageBreakResolution = {
  breakPx: number;
  source: 'dom' | 'canvas' | 'nominal';
};

export function resolveElegantFormalSafePageBreakCanvasPx(
  canvas: HTMLCanvasElement,
  domLineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
  domIntervalsReliable: boolean,
  targetBreakPx: number,
  guardPx: number,
  domSearchPx: number,
  canvasSearchPx: number,
  minBreakPx: number,
): ElegantFormalPageBreakResolution {
  const nominalBreakPx = Math.floor(targetBreakPx);
  const contentLeftPx = Math.floor(canvas.width * 0.1);
  const contentRightPx = canvas.width - contentLeftPx;
  let breakPx = nominalBreakPx;
  let source: ElegantFormalPageBreakResolution['source'] = 'nominal';

  const nominalCutsInk = !isElegantFormalCanvasBreakRowWhitespace(
    canvas,
    nominalBreakPx,
    contentLeftPx,
    contentRightPx,
  );

  if (domIntervalsReliable && domLineIntervalsCanvasPx && domLineIntervalsCanvasPx.length > 0) {
    const domBreakPx = findSafeElegantFormalPageBreakCanvasPx(
      domLineIntervalsCanvasPx,
      targetBreakPx,
      guardPx,
      domSearchPx,
    );
    if (domBreakPx !== nominalBreakPx) {
      breakPx = domBreakPx;
      source = 'dom';
    }
  }

  const domBreakStillCutsInk = !isElegantFormalCanvasBreakRowWhitespace(
    canvas,
    breakPx,
    contentLeftPx,
    contentRightPx,
  );
  const needsCanvasFallback = source === 'nominal'
    || nominalCutsInk
    || !domIntervalsReliable
    || !domLineIntervalsCanvasPx
    || domLineIntervalsCanvasPx.length === 0
    || domBreakStillCutsInk;

  if (needsCanvasFallback) {
    const canvasBreakPx = findSafeElegantFormalPageBreakFromCanvasPixels(
      canvas,
      targetBreakPx,
      guardPx,
      canvasSearchPx,
      minBreakPx,
      contentLeftPx,
      contentRightPx,
    );
    if (
      canvasBreakPx !== nominalBreakPx
      || nominalCutsInk
      || domBreakStillCutsInk
      || !isElegantFormalCanvasBreakRowWhitespace(canvas, breakPx, contentLeftPx, contentRightPx)
    ) {
      breakPx = canvasBreakPx;
      source = 'canvas';
    }
  }

  if (breakPx <= minBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX) {
    breakPx = Math.max(minBreakPx + 1, nominalBreakPx);
    source = nominalBreakPx === breakPx ? 'nominal' : source;
  }

  return { breakPx, source };
}

export type ElegantFormalPdfSliceSegment = {
  startPx: number;
  endPx: number;
  breakSource: ElegantFormalPageBreakResolution['source'];
};

export function isElegantFormalSparseTrailingTailSegment(
  segment: ElegantFormalPdfSliceSegment,
  pageHeightPx: number,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
): boolean {
  const heightPx = segment.endPx - segment.startPx;
  if (heightPx <= 0 || heightPx / pageHeightPx >= ELEGANT_FORMAL_TRAILING_TAIL_SPARSE_RATIO) {
    return false;
  }

  if (!lineIntervalsCanvasPx || lineIntervalsCanvasPx.length === 0) {
    return true;
  }

  const overlapping = lineIntervalsCanvasPx.filter(
    line => line.bottom > segment.startPx + PDF_PAGE_INTERSECTION_EPSILON_PX
      && line.top < segment.endPx - PDF_PAGE_INTERSECTION_EPSILON_PX,
  );
  if (overlapping.length === 0) return true;

  const firstContentTopPx = Math.min(
    ...overlapping.map(line => Math.max(line.top, segment.startPx)),
  );
  return firstContentTopPx > segment.startPx + heightPx * 0.4;
}

export function rebalanceElegantFormalSparseTrailingPdfSliceSegments(
  segments: ElegantFormalPdfSliceSegment[],
  pageHeightPx: number,
  trailingTolerancePx: number,
  _lineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
): ElegantFormalPdfSliceSegment[] {
  if (segments.length < 2) return segments;

  const last = segments[segments.length - 1];
  const lastHeightPx = last.endPx - last.startPx;
  if (lastHeightPx / pageHeightPx >= ELEGANT_FORMAL_TRAILING_TAIL_SPARSE_RATIO) {
    return segments;
  }

  const prev = segments[segments.length - 2];
  const combinedHeightPx = last.endPx - prev.startPx;
  if (combinedHeightPx <= pageHeightPx + trailingTolerancePx) {
    prev.endPx = last.endPx;
    segments.pop();
  }

  return segments;
}

export type PaddedPdfSlice = {
  dataUrl: string;
  paddedHeightPx: number;
  topInsetCanvasPx: number;
  bottomInsetCanvasPx: number;
};

export type ElegantFormalPaddedPdfSlice = PaddedPdfSlice;

export function buildPaddedPdfSlice(
  pdfCanvas: HTMLCanvasElement,
  offsetY: number,
  sliceHeight: number,
  canvasWidthPx: number,
  topInsetCanvasPx: number,
  bottomInsetCanvasPx: number,
): PaddedPdfSlice {
  const safeTopInsetCanvasPx = Math.max(0, Math.round(topInsetCanvasPx));
  const safeBottomInsetCanvasPx = Math.max(0, Math.round(bottomInsetCanvasPx));
  const paddedHeightPx = sliceHeight + safeTopInsetCanvasPx + safeBottomInsetCanvasPx;
  const sliceCanvas = document.createElement('canvas');
  sliceCanvas.width = canvasWidthPx;
  sliceCanvas.height = paddedHeightPx;
  const ctx = sliceCanvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasWidthPx, paddedHeightPx);
    ctx.drawImage(
      pdfCanvas,
      0,
      offsetY,
      canvasWidthPx,
      sliceHeight,
      0,
      safeTopInsetCanvasPx,
      canvasWidthPx,
      sliceHeight,
    );
    // V9: forcibly re-clear the continuation-page top padding band after drawImage.
    // JPEG compression and anti-aliased glyph edges at the slice boundary can leave
    // dark specks in y=0..topPad even though source pixels were drawn starting at topPad.
    if (safeTopInsetCanvasPx > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidthPx, safeTopInsetCanvasPx);
    }
  }

  return {
    dataUrl: sliceCanvas.toDataURL('image/jpeg', 0.95),
    paddedHeightPx,
    topInsetCanvasPx: safeTopInsetCanvasPx,
    bottomInsetCanvasPx: safeBottomInsetCanvasPx,
  };
}

export function buildElegantFormalPaddedPdfSlice(
  pdfCanvas: HTMLCanvasElement,
  offsetY: number,
  sliceHeight: number,
  canvasWidthPx: number,
  topInsetCanvasPx: number,
  bottomInsetCanvasPx: number,
): ElegantFormalPaddedPdfSlice {
  return buildPaddedPdfSlice(
    pdfCanvas,
    offsetY,
    sliceHeight,
    canvasWidthPx,
    topInsetCanvasPx,
    bottomInsetCanvasPx,
  );
}

export function elegantFormalCssPxToPdfMm(cssPx: number, cssWidthPx: number): number {
  if (cssWidthPx <= 0) return 0;
  return (cssPx / cssWidthPx) * CV_PDF_A4_WIDTH_MM;
}

export function planElegantFormalPdfSliceSegments(
  canvasHeightPx: number,
  pageHeightPx: number,
  trailingTolerancePx: number,
  pdfCanvas: HTMLCanvasElement,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
  domIntervalsReliable: boolean,
  guardCanvasPx: number,
  domSearchCanvasPx: number,
  canvasSearchCanvasPx: number,
  breakSourcesOut: string[],
): ElegantFormalPdfSliceSegment[] {
  const segments: ElegantFormalPdfSliceSegment[] = [];
  let offsetY = 0;

  while (offsetY < canvasHeightPx - trailingTolerancePx) {
    let sliceHeight = Math.min(pageHeightPx, canvasHeightPx - offsetY);
    let breakSource: ElegantFormalPageBreakResolution['source'] = 'nominal';

    if (
      sliceHeight >= pageHeightPx - PDF_PAGE_INTERSECTION_EPSILON_PX
      && offsetY + pageHeightPx < canvasHeightPx - trailingTolerancePx
    ) {
      const targetBreakPx = offsetY + pageHeightPx;
      const breakResolution = resolveElegantFormalSafePageBreakCanvasPx(
        pdfCanvas,
        lineIntervalsCanvasPx,
        domIntervalsReliable,
        targetBreakPx,
        guardCanvasPx,
        domSearchCanvasPx,
        canvasSearchCanvasPx,
        offsetY,
      );
      breakSource = breakResolution.source;
      breakSourcesOut.push(breakResolution.source);
      if (breakResolution.breakPx > offsetY + PDF_PAGE_INTERSECTION_EPSILON_PX) {
        sliceHeight = breakResolution.breakPx - offsetY;
      }
    }

    segments.push({ startPx: offsetY, endPx: offsetY + sliceHeight, breakSource });
    offsetY += sliceHeight;
  }

  return rebalanceElegantFormalSparseTrailingPdfSliceSegments(
    segments,
    pageHeightPx,
    trailingTolerancePx,
    lineIntervalsCanvasPx,
  );
}

export type CleanSimplePdfSliceSegment = {
  startPx: number;
  endPx: number;
};

export type CleanSimplePdfSliceBreakDiagnostics = {
  pageIndex: number;
  offsetY: number;
  targetBreakPx: number;
  lineSafeBreakPx: number;
  sentenceAdjustedBreakPx: number | null;
  /** Break passed into the final pixel-authority resolver (DOM/sentence hint only). */
  preCanvasWhitespaceBreakPx: number;
  /** V11 FINAL AUTHORITY: center of a verified zero-ink canvas row band, or null if the
   *  resolver had no legal window to search (`finalBreakPx` then falls back unchanged). */
  canvasWhitespaceBreakPx: number | null;
  canvasWhitespaceBandStartPx: number | null;
  canvasWhitespaceBandEndPx: number | null;
  canvasWhitespaceBandHeightPx: number;
  canvasWhitespaceFound: boolean;
  finalBreakPx: number;
  sliceHeight: number;
  minBreakPx: number;
  topInsetCanvasPx: number;
  bottomInsetCanvasPx: number;
  breakSource: ElegantFormalPageBreakResolution['source'];
  sentenceRelocationApplied: boolean;
  previousLineInterval: { top: number; bottom: number } | null;
  nextLineInterval: { top: number; bottom: number } | null;
};

function getCleanSimpleLineIntervalsInSpan(
  span: { top: number; bottom: number },
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }>,
): Array<{ top: number; bottom: number }> {
  return lineIntervalsCanvasPx
    .filter(line => (
      line.bottom > span.top + PDF_PAGE_INTERSECTION_EPSILON_PX
      && line.top < span.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX
    ))
    .sort((a, b) => a.top - b.top || a.bottom - b.bottom);
}

function findCleanSimplePreviousAndNextLineIntervals(
  breakPx: number,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
): { previousLine: { top: number; bottom: number } | null; nextLine: { top: number; bottom: number } | null } {
  if (!lineIntervalsCanvasPx || lineIntervalsCanvasPx.length === 0) {
    return { previousLine: null, nextLine: null };
  }
  const sorted = [...lineIntervalsCanvasPx].sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  let previousLine: { top: number; bottom: number } | null = null;
  let nextLine: { top: number; bottom: number } | null = null;
  for (const line of sorted) {
    if (line.bottom <= breakPx + PDF_PAGE_INTERSECTION_EPSILON_PX) previousLine = line;
    if (line.top >= breakPx - PDF_PAGE_INTERSECTION_EPSILON_PX && !nextLine) {
      nextLine = line;
      break;
    }
  }
  return { previousLine, nextLine };
}

/**
 * True when `breakPx` lies strictly inside a measured text-line ink band (not merely
 * on its top/bottom edge). Bitmap slicing at such a Y physically cuts the row in half.
 */
export function isCleanSimpleBreakInsideLineInterval(
  breakPx: number,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }>,
): { top: number; bottom: number } | null {
  for (const line of lineIntervalsCanvasPx) {
    if (
      breakPx > line.top + PDF_PAGE_INTERSECTION_EPSILON_PX
      && breakPx < line.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX
    ) {
      return line;
    }
  }
  return null;
}

/** True when a planned segment boundary is in whitespace with guard on both sides. */
export function isCleanSimpleSegmentBoundaryLineSafe(
  boundaryPx: number,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }>,
  guardCanvasPx: number,
): boolean {
  return isCleanSimpleBreakInsideLineInterval(boundaryPx, lineIntervalsCanvasPx) === null
    && !isUnsafeElegantFormalPageBreakCanvasPx(boundaryPx, lineIntervalsCanvasPx, guardCanvasPx);
}

export type CleanSimpleLineAtomicBreakResolution = {
  breakPx: number;
  candidateBreakPx: number;
  movedPx: number;
  intersectedLine: { top: number; bottom: number } | null;
  applied: boolean;
};

/**
 * Final line-atomic snap for Clean Simple PDF slicing. After sentence-aware relocation
 * (which may land on a sentence/line *top* — still unsafe for bitmap crops because
 * anti-aliased ink extends above/below DOM rects), this resolver guarantees the break
 * sits in a real whitespace gap between two rendered lines with guard pixels on both
 * sides. Never allows a page boundary to intersect any line interval.
 */
export function resolveCleanSimpleLineAtomicBreakCanvasPx(
  candidateBreakPx: number,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
  guardCanvasPx: number,
  searchRangeCanvasPx: number,
  minBreakPx: number,
  maxBreakPx: number,
): CleanSimpleLineAtomicBreakResolution {
  const candidate = Math.floor(candidateBreakPx);
  if (!lineIntervalsCanvasPx || lineIntervalsCanvasPx.length === 0) {
    return {
      breakPx: candidate,
      candidateBreakPx: candidate,
      movedPx: 0,
      intersectedLine: null,
      applied: false,
    };
  }

  const sorted = [...lineIntervalsCanvasPx].sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  const guardPx = Math.max(1, guardCanvasPx);
  const intersectedLine = isCleanSimpleBreakInsideLineInterval(candidate, sorted);
  const needsSnap = intersectedLine !== null
    || isUnsafeElegantFormalPageBreakCanvasPx(candidate, sorted, guardPx);

  if (!needsSnap) {
    return {
      breakPx: candidate,
      candidateBreakPx: candidate,
      movedPx: 0,
      intersectedLine,
      applied: false,
    };
  }

  const isSafe = (y: number) => (
    y > minBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX
    && y <= maxBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX
    && isCleanSimpleBreakInsideLineInterval(y, sorted) === null
    && !isUnsafeElegantFormalPageBreakCanvasPx(y, sorted, guardPx)
  );

  // When the candidate is inside a line band, search upward first for the nearest
  // whitespace row *before* that line — never push the break down through the line.
  if (intersectedLine) {
    for (let y = Math.floor(intersectedLine.top - guardPx); y >= minBreakPx; y -= 1) {
      if (isSafe(y)) {
        return {
          breakPx: y,
          candidateBreakPx: candidate,
          movedPx: y - candidate,
          intersectedLine,
          applied: true,
        };
      }
    }
  }

  // Candidate is on a line edge / too close to ink — search near candidate for safe gap.
  let safeBreakPx = findSafeElegantFormalPageBreakCanvasPx(
    sorted,
    candidate,
    guardPx,
    searchRangeCanvasPx,
  );
  if (!isSafe(safeBreakPx)) {
    for (let y = candidate; y >= Math.max(minBreakPx, candidate - searchRangeCanvasPx); y -= 1) {
      if (isSafe(y)) {
        safeBreakPx = y;
        break;
      }
    }
  }
  safeBreakPx = Math.min(safeBreakPx, maxBreakPx);

  const applied = Math.abs(safeBreakPx - candidate) > PDF_PAGE_INTERSECTION_EPSILON_PX
    || intersectedLine !== null;
  return {
    breakPx: safeBreakPx,
    candidateBreakPx: candidate,
    movedPx: safeBreakPx - candidate,
    intersectedLine,
    applied,
  };
}

/** @deprecated V10+ uses resolveCleanSimpleLineAtomicBreakCanvasPx instead. */
export function applyCleanSimplePostLineBreakGuardCanvasPx(
  breakPx: number,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
  guardCanvasPx: number,
  maxBreakPx: number,
): number {
  if (!lineIntervalsCanvasPx || lineIntervalsCanvasPx.length === 0 || guardCanvasPx <= 0) return breakPx;
  const resolution = resolveCleanSimpleLineAtomicBreakCanvasPx(
    breakPx,
    lineIntervalsCanvasPx,
    guardCanvasPx,
    guardCanvasPx * 8,
    0,
    maxBreakPx,
  );
  return resolution.breakPx;
}

/** True when every pixel in the continuation-page top padding band is white/near-white. */
export function isCleanSimpleTopPaddingBandClean(
  sliceCanvas: HTMLCanvasElement,
  topInsetCanvasPx: number,
  inkThreshold = 248,
): boolean {
  const topPad = Math.max(0, Math.round(topInsetCanvasPx));
  if (topPad <= 0) return true;
  const ctx = sliceCanvas.getContext('2d');
  if (!ctx) return false;
  const imageData = ctx.getImageData(0, 0, sliceCanvas.width, topPad);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3];
    if (alpha === 0) continue;
    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    if (red < inkThreshold || green < inkThreshold || blue < inkThreshold) return false;
  }
  return true;
}

export function getCleanSimplePdfContentBoundsCanvas(
  canvasWidthPx: number,
  captureWidthCssPx: number,
  cssToCanvasScale: number,
): { contentLeftPx: number; contentRightPx: number } {
  const scale = captureWidthCssPx > 0 ? canvasWidthPx / captureWidthCssPx : cssToCanvasScale;
  const left = Math.max(0, Math.round(CLEAN_SIMPLE_PDF_HORIZONTAL_PADDING_CSS_PX * scale));
  return {
    contentLeftPx: left,
    contentRightPx: Math.max(left + 1, canvasWidthPx - left),
  };
}

/**
 * Measures the real rendered vertical span (top of its first line to bottom of its last
 * line) of every sentence inside every Clean Simple Professional Summary paragraph, via
 * DOM Range measurement — the exact same `getClientRects()` technique used for
 * `collectElegantFormalTextLineIntervalsCss`. This never inspects or changes the DOM
 * (no markers, no new elements): it re-splits each paragraph's own rendered text with
 * the identical sentence-boundary detection already used to build that text
 * (`splitCleanSimpleSummarySentenceRuns`), then measures a `Range` over each sentence's
 * character offsets within the paragraph's single text node.
 *
 * The line-interval-based safe break search (V7) only guarantees a break never lands
 * mid-glyph — it happily lands between two lines of the *same* sentence, which is what
 * let a page end with a sentence's first line or two (e.g. "Rooted in") and continue the
 * rest of that same sentence on the next page. These spans let slice planning recognize
 * "this candidate break is inside a sentence" and prefer moving it to the sentence's own
 * start instead.
 */
export function collectCleanSimpleSummarySentenceSpansCss(root: HTMLElement): ElegantFormalTextLineIntervalCss[] {
  void root.offsetHeight;
  const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
  if (!rootRect) return [];
  const rootTop = rootRect.top;

  const spans: ElegantFormalTextLineIntervalCss[] = [];
  const blocks = root.querySelectorAll<HTMLElement>('[data-clean-simple-summary-block]');

  blocks.forEach((block) => {
    const textNode = block.firstChild;
    const text = block.textContent ?? '';
    // The template always renders each summary paragraph as exactly one text node (see
    // appendCleanSimpleSummaryParagraph-equivalent in clean-simple-pdf-template.ts) — if
    // that ever isn't true, skip sentence-level protection for this block rather than
    // guess at wrong offsets; the line-interval safe break still applies as a fallback.
    if (!(textNode instanceof Text) || !text.trim()) return;

    const sentences = splitCleanSimpleSummarySentenceRuns(text);
    if (sentences.length <= 1) return;

    let charOffset = 0;
    sentences.forEach((sentence) => {
      const startOffset = Math.min(charOffset, textNode.length);
      const endOffset = Math.min(startOffset + sentence.length, textNode.length);
      charOffset = endOffset + 1; // +1 to skip the single joining space
      if (endOffset <= startOffset) return;

      const range = document.createRange();
      try {
        range.setStart(textNode, startOffset);
        range.setEnd(textNode, endOffset);
      } catch {
        return;
      }
      const rects = typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : [];
      let top: number | null = null;
      let bottom: number | null = null;
      if (rects.length > 0) {
        top = Math.min(...rects.map(r => r.top)) - rootTop;
        bottom = Math.max(...rects.map(r => r.bottom)) - rootTop;
      } else {
        // Some WebViews return empty getClientRects() for sub-ranges while the full
        // paragraph still lays out correctly — estimate this sentence's vertical span
        // from the block box and character offsets so sentence-aware breaks still work.
        const blockRect = getPositiveRect(block.getBoundingClientRect(), block);
        if (blockRect && text.length > 0) {
          const startFrac = startOffset / text.length;
          const endFrac = endOffset / text.length;
          top = (blockRect.top - rootTop) + blockRect.height * startFrac;
          bottom = (blockRect.top - rootTop) + blockRect.height * endFrac;
        }
      }
      if (top !== null && bottom !== null && bottom > top + PDF_PAGE_INTERSECTION_EPSILON_PX) {
        spans.push({ topCssPx: top, bottomCssPx: bottom });
      }
    });
  });

  return spans;
}

// Fallback when rendered line intervals are unavailable: treat a break as a bad prefix
// split only when less than ~45% of the sentence span would remain on the current page.
const CLEAN_SIMPLE_SENTENCE_BAD_SPLIT_PREFIX_RATIO = 0.45;

export type CleanSimpleSentenceBreakAdjustment = {
  breakPx: number;
  applied: boolean;
  reason: 'line-prefix-split' | 'ratio-prefix-split' | 'min-break-rejected' | 'not-inside-sentence' | null;
};

/**
 * If `breakPx` would split a multi-line sentence after only its opening line(s) — the
 * exact "Rooted in" / "a mathematics background..." failure mode — relocate the break to
 * that sentence's own top so page 2 starts with the full sentence. Uses rendered line
 * intervals when available (precise, immune to the V8 50%-of-height edge case on
 * two-line sentences); falls back to span-height ratio only when line data is missing.
 */
export function adjustCleanSimpleBreakForSentenceBoundary(
  breakPx: number,
  sentenceSpansCanvasPx: Array<{ top: number; bottom: number }>,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
  minBreakPx: number,
): CleanSimpleSentenceBreakAdjustment {
  for (const span of sentenceSpansCanvasPx) {
    const insideSentence = breakPx > span.top + PDF_PAGE_INTERSECTION_EPSILON_PX
      && breakPx < span.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX;
    if (!insideSentence) continue;

    let isBadPrefixSplit = false;
    if (lineIntervalsCanvasPx && lineIntervalsCanvasPx.length > 0) {
      const sentenceLines = getCleanSimpleLineIntervalsInSpan(span, lineIntervalsCanvasPx);
      if (sentenceLines.length >= 2) {
        let linesBeforeBreak = 0;
        for (const line of sentenceLines) {
          if (line.bottom <= breakPx + PDF_PAGE_INTERSECTION_EPSILON_PX) linesBeforeBreak += 1;
          else break;
        }
        const linesAfterBreak = sentenceLines.length - linesBeforeBreak;
        isBadPrefixSplit = linesBeforeBreak <= 1 || linesAfterBreak >= linesBeforeBreak;
      }
    } else {
      const sentenceHeightPx = span.bottom - span.top;
      const shownBeforeBreakPx = breakPx - span.top;
      isBadPrefixSplit = sentenceHeightPx > 0
        && shownBeforeBreakPx < sentenceHeightPx * CLEAN_SIMPLE_SENTENCE_BAD_SPLIT_PREFIX_RATIO;
    }

    if (!isBadPrefixSplit) continue;
    if (span.top > minBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX) {
      // Target the first rendered line of the sentence — the line-atomic snap that runs
      // afterward will move this to real whitespace *before* that line, never at its top.
      let targetPx = span.top;
      if (lineIntervalsCanvasPx && lineIntervalsCanvasPx.length > 0) {
        const sentenceLines = getCleanSimpleLineIntervalsInSpan(span, lineIntervalsCanvasPx);
        if (sentenceLines.length > 0) targetPx = sentenceLines[0].top;
      }
      return {
        breakPx: targetPx,
        applied: true,
        reason: lineIntervalsCanvasPx && lineIntervalsCanvasPx.length > 0
          ? 'line-prefix-split'
          : 'ratio-prefix-split',
      };
    }
    return { breakPx, applied: false, reason: 'min-break-rejected' };
  }
  return { breakPx, applied: false, reason: null };
}

/**
 * Every pixel in a row is checked (no sampling stride) against a strict near-white
 * threshold. This is the only ink test the Clean Simple final boundary resolver trusts —
 * a coarse sampled scan can step over a single-pixel-wide anti-aliased glyph stroke
 * between sample columns and misreport a row as clean, which is exactly the class of bug
 * a "safe" DOM-measured break could still hit on real Android WebView rasterization.
 */
function isCleanSimpleCanvasPixelInk(red: number, green: number, blue: number, alpha: number): boolean {
  if (alpha <= CLEAN_SIMPLE_CANVAS_INK_ALPHA_THRESHOLD) return false;
  return red < CLEAN_SIMPLE_CANVAS_INK_NEAR_WHITE_THRESHOLD
    || green < CLEAN_SIMPLE_CANVAS_INK_NEAR_WHITE_THRESHOLD
    || blue < CLEAN_SIMPLE_CANVAS_INK_NEAR_WHITE_THRESHOLD;
}

function computeCleanSimpleCanvasInkRows(
  canvas: HTMLCanvasElement,
  topPx: number,
  bottomPx: number,
  leftPx: number,
  rightPx: number,
): boolean[] {
  const top = Math.max(0, Math.floor(topPx));
  const bottom = Math.min(canvas.height - 1, Math.ceil(bottomPx));
  if (bottom < top) return [];

  const left = Math.max(0, Math.floor(leftPx));
  const right = Math.min(canvas.width, Math.ceil(rightPx));
  const width = Math.max(1, right - left);
  const height = bottom - top + 1;
  const ctx = canvas.getContext('2d');
  if (!ctx || height <= 0) return Array.from({ length: Math.max(0, height) }, () => true);

  const data = ctx.getImageData(left, top, width, height).data;
  const inkRow: boolean[] = new Array(height).fill(false);
  for (let row = 0; row < height; row += 1) {
    const rowOffset = row * width * 4;
    for (let x = 0; x < width; x += 1) {
      const index = rowOffset + x * 4;
      if (isCleanSimpleCanvasPixelInk(data[index], data[index + 1], data[index + 2], data[index + 3])) {
        inkRow[row] = true;
        break;
      }
    }
  }
  return inkRow;
}

/**
 * V12 content-completeness fix: finds the true bottom of rendered content on the
 * Clean Simple canvas — the canvas-y one past the very last row (within
 * `[contentLeftPx, contentRightPx)`) that contains any ink — using the exact same
 * full-resolution, no-stride pixel scan as the V11 whitespace-break resolver.
 *
 * This exists because both the pre-slice "visible bottom" crop
 * (`findVisibleCanvasBottom`) and the flat `PDF_TRAILING_SLICE_TOLERANCE_MM` applied at
 * the tail of `planCleanSimplePdfSliceSegments` were sized/sampled for detecting
 * *approximately* where trailing whitespace begins, not for guaranteeing every real
 * content pixel is preserved. A coarse dual-axis sample stride (`findVisibleCanvasBottom`)
 * can step clean over a short, sparse trailing section like Languages, and a flat ~30px
 * trailing tolerance can silently swallow one real text row sitting right at the bottom
 * of the captured canvas. Callers use this value to cap those heuristics so they can
 * never remove or skip past genuine content, regardless of how sparse/short it is.
 */
export function findCleanSimpleCanvasContentBottomPx(
  canvas: HTMLCanvasElement,
  contentLeftPx: number,
  contentRightPx: number,
): number {
  const height = canvas.height;
  if (height <= 0) return 0;
  const inkRows = computeCleanSimpleCanvasInkRows(canvas, 0, height - 1, contentLeftPx, contentRightPx);
  for (let row = inkRows.length - 1; row >= 0; row -= 1) {
    if (inkRows[row]) return Math.min(height, row + 1);
  }
  return 0;
}

export type CleanSimpleCanvasWhitespaceBreakOptions = {
  contentLeftPx: number;
  contentRightPx: number;
  minBreakPx: number;
  maxBreakPx: number;
  searchRangePx: number;
  minBandHeightPx: number;
};

export type CleanSimpleCanvasWhitespaceBreakResult = {
  breakPx: number;
  bandStartPx: number;
  bandEndPx: number;
  bandHeightPx: number;
  targetBreakPx: number;
  movedPx: number;
  found: boolean;
};

/**
 * FINAL AUTHORITY for every Clean Simple PDF page boundary. Ignores DOM/sentence
 * measurements entirely and inspects only the actual rasterized html2canvas bitmap: it
 * finds a horizontal band of rows with zero ink pixels (full-row scan, strict near-white
 * threshold — see `isCleanSimpleCanvasPixelInk`) at or before `targetBreakPx`, and
 * returns the center of that band as the break. This can never return a break inside a
 * row that contains any ink pixel in the real captured bitmap — the exact invariant
 * DOM-based line-interval reasoning (V7-V10) could not guarantee, because rasterized
 * glyph positions on real Android WebView captures can drift a few px from whatever was
 * measured via Range.getClientRects() before html2canvas ran.
 *
 * `targetBreakPx` may still come from a DOM/sentence-aware hint (natural paragraph/line
 * boundary preference) — but that hint is never trusted on its own; this resolver always
 * re-verifies it against the real bitmap and moves it if needed.
 */
export function findCleanSimpleCanvasWhitespaceBreak(
  canvas: HTMLCanvasElement,
  targetBreakPx: number,
  options: CleanSimpleCanvasWhitespaceBreakOptions,
): CleanSimpleCanvasWhitespaceBreakResult {
  const target = Math.floor(targetBreakPx);
  const searchFloorPx = Math.max(0, Math.floor(options.minBreakPx));
  const searchCeilingPx = Math.min(canvas.height - 1, Math.floor(options.maxBreakPx));
  const notFound = (): CleanSimpleCanvasWhitespaceBreakResult => ({
    breakPx: target,
    bandStartPx: target,
    bandEndPx: target,
    bandHeightPx: 0,
    targetBreakPx: target,
    movedPx: 0,
    found: false,
  });
  if (searchCeilingPx <= searchFloorPx) return notFound();

  // Scan the entire legal window in one pass — never only a narrow radius around the
  // target — so a clean band anywhere between the minimum allowed break and the nominal
  // target is always found. This is what satisfies "if no whitespace band exists near
  // the target, move the break earlier until a clean band is found" instead of only
  // checking a small fixed radius and giving up.
  const downwardAllowancePx = Math.max(0, searchCeilingPx - target);
  const scanTop = Math.max(searchFloorPx, target - options.searchRangePx);
  const scanBottom = Math.min(searchCeilingPx, target + downwardAllowancePx);
  const inkRows = computeCleanSimpleCanvasInkRows(
    canvas,
    scanTop,
    scanBottom,
    options.contentLeftPx,
    options.contentRightPx,
  );
  if (inkRows.length === 0) return notFound();

  type Band = { startIndex: number; endIndex: number; heightPx: number };
  const collectBands = (minHeightPx: number): Band[] => {
    const bands: Band[] = [];
    let runStart: number | null = null;
    for (let i = 0; i < inkRows.length; i += 1) {
      if (!inkRows[i]) {
        if (runStart === null) runStart = i;
      } else if (runStart !== null) {
        const heightPx = i - runStart;
        if (heightPx >= minHeightPx) bands.push({ startIndex: runStart, endIndex: i - 1, heightPx });
        runStart = null;
      }
    }
    if (runStart !== null) {
      const heightPx = inkRows.length - runStart;
      if (heightPx >= minHeightPx) bands.push({ startIndex: runStart, endIndex: inkRows.length - 1, heightPx });
    }
    return bands;
  };

  // Prefer a full-height guard band; if real line spacing is too tight to ever offer one,
  // degrade the requirement rather than ever choosing a break inside an ink row — a
  // thinner-than-ideal blank gap is still infinitely better than splitting a text row.
  const minHeightSteps = [
    Math.max(1, options.minBandHeightPx),
    Math.max(1, Math.ceil(options.minBandHeightPx / 2)),
    2,
    1,
  ];

  let bands: Band[] = [];
  for (const minHeightPx of minHeightSteps) {
    bands = collectBands(minHeightPx);
    if (bands.length > 0) break;
  }
  if (bands.length === 0) return notFound();

  let best: Band | null = null;
  let bestScore = Infinity;
  for (const band of bands) {
    const centerIndex = band.startIndex + Math.floor(band.heightPx / 2);
    const centerPx = scanTop + centerIndex;
    // Bands at or before the nominal target are strongly preferred — moving the break
    // earlier only trims trailing whitespace off this page. A band after target is
    // penalized so it's chosen only when nothing usable exists at or before target.
    const distance = centerPx <= target ? (target - centerPx) : (centerPx - target) * 4;
    if (distance < bestScore) {
      bestScore = distance;
      best = band;
    }
  }
  if (!best) return notFound();

  const centerIndex = best.startIndex + Math.floor(best.heightPx / 2);
  const breakPx = scanTop + centerIndex;
  return {
    breakPx,
    bandStartPx: scanTop + best.startIndex,
    bandEndPx: scanTop + best.endIndex,
    bandHeightPx: best.heightPx,
    targetBreakPx: target,
    movedPx: breakPx - target,
    found: true,
  };
}

export function planCleanSimplePdfSliceSegments(
  canvasHeightPx: number,
  pageHeightPx: number,
  trailingTolerancePx: number,
  pdfCanvas: HTMLCanvasElement,
  contentLeftPx: number,
  contentRightPx: number,
  guardCanvasPx: number,
  canvasSearchCanvasPx: number,
  topInsetCanvasPx = 0,
  bottomInsetCanvasPx = 0,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null = null,
  _domIntervalsReliable = false,
  domSearchCanvasPx = 0,
  _sentenceSpansCanvasPx: Array<{ top: number; bottom: number }> | null = null,
  postLineGuardCanvasPx = 0,
  breakDiagnosticsOut: CleanSimplePdfSliceBreakDiagnostics[] | null = null,
): CleanSimplePdfSliceSegment[] {
  const segments: CleanSimplePdfSliceSegment[] = [];
  let offsetY = 0;
  let pageIndex = 0;

  // V12 content-completeness guarantee: never let the flat trailing tolerance extend
  // above the real last row of ink. If genuine content (e.g. a Languages row) sits
  // closer to the canvas bottom than `trailingTolerancePx`, shrink the effective
  // tolerance so the final segment's endPx is mathematically guaranteed to reach past
  // it — see findCleanSimpleCanvasContentBottomPx for the full-resolution scan this
  // relies on. When trailing whitespace genuinely exceeds the flat tolerance (the
  // common case), behavior is unchanged.
  const contentBottomPx = findCleanSimpleCanvasContentBottomPx(pdfCanvas, contentLeftPx, contentRightPx);
  const effectiveTrailingTolerancePx = Math.max(
    0,
    Math.min(trailingTolerancePx, canvasHeightPx - contentBottomPx),
  );

  while (offsetY < canvasHeightPx - effectiveTrailingTolerancePx) {
    // Continuation pages (pageIndex > 0) bake in a top inset at render time, which
    // shrinks how much source canvas height that page can actually show versus a raw
    // pageHeightPx slice. Planning must use this same reduced budget up front — picking
    // a break based on the full pageHeightPx here, only to have the renderer silently
    // crop the slice back down to size afterward, drops whatever fell in the gap (never
    // shown on this page *or* the next) and cuts mid-glyph instead of at a safe row.
    const topPadForThisPage = pageIndex === 0 ? 0 : topInsetCanvasPx;
    const maxHeightAsFinalPage = Math.max(1, pageHeightPx - topPadForThisPage);
    const remainingPx = canvasHeightPx - offsetY - effectiveTrailingTolerancePx;
    const isFinalPage = remainingPx <= maxHeightAsFinalPage + PDF_PAGE_INTERSECTION_EPSILON_PX;
    // A non-final page additionally reserves a bottom safety band so no line of text is
    // ever assigned pixels within that band — it is real, guaranteed-blank margin, not
    // just a "best-effort" whitespace search near the physical edge.
    const maxUsableHeightPx = isFinalPage
      ? maxHeightAsFinalPage
      : Math.max(1, pageHeightPx - topPadForThisPage - bottomInsetCanvasPx);

    let sliceHeight = Math.min(maxUsableHeightPx, canvasHeightPx - offsetY);

    if (
      !isFinalPage
      && sliceHeight >= maxUsableHeightPx - PDF_PAGE_INTERSECTION_EPSILON_PX
    ) {
      const targetBreakPx = offsetY + maxUsableHeightPx;
      const minBreakPx = offsetY + Math.min(maxUsableHeightPx * 0.22, maxUsableHeightPx - guardCanvasPx * 2);
      // Clean Simple V13: do not let legacy DOM/sentence relocation choose an early
      // page break for the actual export. Those hints fixed earlier paragraph aesthetics
      // but became too conservative for long summaries, leaving page 1 with a large blank
      // area even when several more rendered rows could fit. The final authority is now
      // the actual canvas: start from the latest usable target and let the pixel
      // whitespace resolver move only as much as needed to avoid ink.
      const lineSafeBreakPx = targetBreakPx;
      let resolvedBreakPx = targetBreakPx;
      const sentenceAdjustedBreakPx: number | null = null;
      const sentenceRelocationApplied = false;
      // Kept in diagnostics as null/false so older debug consumers can tell no legacy
      // sentence relocation influenced this break.
      const preCanvasWhitespaceBreakPx = resolvedBreakPx;
      const approxCssToCanvasScale = guardCanvasPx > 0 ? guardCanvasPx / CLEAN_SIMPLE_PAGE_BREAK_GUARD_PX : 1;
      const minBandHeightPx = Math.max(
        8,
        Math.round(CLEAN_SIMPLE_CANVAS_WHITESPACE_MIN_BAND_CSS_PX * approxCssToCanvasScale),
        // Folds the old "post-line guard" margin (V9) into the new band-height floor: a
        // clean band must be at least this tall so the resolved center still keeps that
        // many guard px of verified-blank canvas on both sides of the final break.
        Math.round(postLineGuardCanvasPx * 2),
      );
      const canvasWhitespaceSearchPx = Math.max(canvasSearchCanvasPx, domSearchCanvasPx, minBandHeightPx * 8);
      const canvasWhitespaceMaxBreakPx = targetBreakPx
        + Math.min(canvasSearchCanvasPx * 0.5, guardCanvasPx * 2);
      const canvasWhitespace = findCleanSimpleCanvasWhitespaceBreak(
        pdfCanvas,
        resolvedBreakPx,
        {
          contentLeftPx,
          contentRightPx,
          minBreakPx,
          maxBreakPx: canvasWhitespaceMaxBreakPx,
          searchRangePx: canvasWhitespaceSearchPx,
          minBandHeightPx,
        },
      );
      if (canvasWhitespace.found) resolvedBreakPx = canvasWhitespace.breakPx;
      const { previousLine, nextLine } = findCleanSimplePreviousAndNextLineIntervals(
        resolvedBreakPx,
        lineIntervalsCanvasPx,
      );
      if (breakDiagnosticsOut) {
        breakDiagnosticsOut.push({
          pageIndex,
          offsetY,
          targetBreakPx,
          lineSafeBreakPx,
          sentenceAdjustedBreakPx,
          preCanvasWhitespaceBreakPx,
          canvasWhitespaceBreakPx: canvasWhitespace.found ? canvasWhitespace.breakPx : null,
          canvasWhitespaceBandStartPx: canvasWhitespace.found ? canvasWhitespace.bandStartPx : null,
          canvasWhitespaceBandEndPx: canvasWhitespace.found ? canvasWhitespace.bandEndPx : null,
          canvasWhitespaceBandHeightPx: canvasWhitespace.bandHeightPx,
          canvasWhitespaceFound: canvasWhitespace.found,
          finalBreakPx: resolvedBreakPx,
          sliceHeight: Math.max(0, resolvedBreakPx - offsetY),
          minBreakPx,
          topInsetCanvasPx: topPadForThisPage,
          bottomInsetCanvasPx: isFinalPage ? 0 : bottomInsetCanvasPx,
          breakSource: 'canvas',
          sentenceRelocationApplied,
          previousLineInterval: previousLine,
          nextLineInterval: nextLine,
        });
      }
      // Accept up to `canvasWhitespaceMaxBreakPx` (not just `targetBreakPx`): the pixel
      // resolver is explicitly allowed a small amount of downward slack into the
      // reserved bottom-guard margin (never past it) when that's where the nearest real
      // whitespace band actually is — rejecting that here would silently discard a
      // verified-safe break and fall back to an unverified fixed-height cut instead.
      if (
        resolvedBreakPx > offsetY + PDF_PAGE_INTERSECTION_EPSILON_PX
        && resolvedBreakPx <= canvasWhitespaceMaxBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX
      ) {
        sliceHeight = resolvedBreakPx - offsetY;
      } else if (breakDiagnosticsOut) {
        const last = breakDiagnosticsOut[breakDiagnosticsOut.length - 1];
        if (last) {
          last.finalBreakPx = offsetY + sliceHeight;
          last.sliceHeight = sliceHeight;
        }
      }
    }

    segments.push({ startPx: offsetY, endPx: offsetY + sliceHeight });
    offsetY += sliceHeight;
    pageIndex += 1;
  }

  return segments;
}

export type CleanSimpleBlockKind =
  | 'summary-heading'
  | 'summary-block'
  | 'section-heading'
  | 'final-section-group'
  | 'experience-entry'
  | 'education-entry';

export type CleanSimpleBlockDiagnostic = {
  kind: CleanSimpleBlockKind;
  keepGroupId: string;
  textPreview: string;
  top: number | null;
  bottom: number | null;
  height: number | null;
  pageBoundary: number | null;
  straddles: boolean;
  shifted: boolean;
  appliedMarginTopPx: number;
};

export type CleanSimpleFinalSectionsPaginationDiagnostic = {
  found: boolean;
  beforeTop: number | null;
  beforeBottom: number | null;
  beforeHeight: number | null;
  afterTop: number | null;
  afterBottom: number | null;
  afterHeight: number | null;
  pageBoundary: number | null;
  straddledBefore: boolean;
  straddlesAfter: boolean;
  fitsOnContinuationPage: boolean;
  spacerHeightPx: number;
  moved: boolean;
  textPreview: string;
};

export type CleanSimpleBlockPaginationReport = {
  pageHeightCssPx: number | null;
  topInsetCssPx: number;
  bottomInsetCssPx: number;
  blockCount: number;
  blocks: CleanSimpleBlockDiagnostic[];
  finalSections: CleanSimpleFinalSectionsPaginationDiagnostic;
};

function cleanSimpleTextPreview(element: HTMLElement): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 96);
}

function getCleanSimpleLineHeightPx(element: HTMLElement): number {
  const fallback = 10.2 * 1.32;
  if (typeof window === 'undefined' || !window.getComputedStyle) return fallback;
  const computed = window.getComputedStyle(element);
  const fontSize = Number.parseFloat(computed.fontSize) || 10.2;
  const lineHeightRaw = computed.lineHeight;
  if (lineHeightRaw.endsWith('px')) {
    const parsed = Number.parseFloat(lineHeightRaw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fontSize * 1.32;
  }
  const parsed = Number.parseFloat(lineHeightRaw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed * fontSize : fontSize * 1.32;
}

function cleanSimpleEmptyBlockPaginationReport(): CleanSimpleBlockPaginationReport {
  return {
    pageHeightCssPx: null,
    topInsetCssPx: CLEAN_SIMPLE_PDF_PAGE_TOP_INSET_CSS_PX,
    bottomInsetCssPx: CLEAN_SIMPLE_PDF_PAGE_BOTTOM_INSET_CSS_PX,
    blockCount: 0,
    blocks: [],
    finalSections: {
      found: false,
      beforeTop: null,
      beforeBottom: null,
      beforeHeight: null,
      afterTop: null,
      afterBottom: null,
      afterHeight: null,
      pageBoundary: null,
      straddledBefore: false,
      straddlesAfter: false,
      fitsOnContinuationPage: false,
      spacerHeightPx: 0,
      moved: false,
      textPreview: '',
    },
  };
}

/**
 * Clean Simple's real pre-capture page planner. Fixed-height canvas slicing plus a
 * pixel-level whitespace search (see `planCleanSimplePdfSliceSegments`) only guarantees
 * a break never lands mid-glyph — it has no idea a "clean" whitespace row it just picked
 * sits directly between a section heading and that section's first entry, orphaning the
 * heading. This pass runs first, entirely in the DOM, and physically relocates any
 * heading/entry that would straddle (or be orphaned across) a page boundary by inserting
 * a margin-top spacer, so by the time html2canvas rasterizes the page the keep-together
 * groups already live wholly on one page and can never be picked apart downstream.
 */
export function applyCleanSimpleKeepTogetherPagination(root: HTMLElement): CleanSimpleBlockPaginationReport {
  void root.offsetHeight;
  const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
  const rootWidth = rootRect?.width || root.offsetWidth || root.scrollWidth;
  if (rootWidth <= 0) return cleanSimpleEmptyBlockPaginationReport();

  const rootBox = { top: rootRect?.top ?? 0 };
  const pageHeightCssPx = rootWidth * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return cleanSimpleEmptyBlockPaginationReport();

  const maxKeepGroupHeightPx = pageHeightCssPx * CLEAN_SIMPLE_MAX_KEEP_GROUP_PAGE_RATIO;
  // A keep-group relocated onto a continuation page still has to fit inside that page's
  // reduced usable height (full page height minus baked top+bottom insets) — otherwise
  // the shift just recreates the same straddle one page later.
  const continuationUsableHeightPx = Math.max(
    pageHeightCssPx * 0.3,
    pageHeightCssPx - CLEAN_SIMPLE_PDF_PAGE_TOP_INSET_CSS_PX - CLEAN_SIMPLE_PDF_PAGE_BOTTOM_INSET_CSS_PX,
  );

  const rectOf = (el: Element | null | undefined): { top: number; bottom: number; height: number } | null => {
    if (!el || !(el instanceof HTMLElement)) return null;
    return getRelativeExportRect(rootBox, el, root);
  };

  const pageIndexOf = (topPx: number): number => (
    Math.floor((topPx + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx)
  );

  const rectStraddles = (rect: { top: number; bottom: number }): boolean => (
    pageIndexOf(rect.top) !== Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx)
  );

  const rectFromElements = (...elements: Array<Element | null | undefined>): { top: number; bottom: number; height: number } | null => {
    const rects = elements
      .map((element) => rectOf(element))
      .filter((rect): rect is { top: number; bottom: number; height: number } => Boolean(rect));
    if (rects.length === 0) return null;
    const top = Math.min(...rects.map(rect => rect.top));
    const bottom = Math.max(...rects.map(rect => rect.bottom));
    return { top, bottom, height: bottom - top };
  };

  const finalSectionsChildUnionRect = (wrapper: HTMLElement): { top: number; bottom: number; height: number } | null => {
    const meaningfulChildren = Array.from(wrapper.querySelectorAll<HTMLElement>('[data-export-meaningful="true"], [data-clean-simple-skill="item"]'))
      // The wrapper is itself meaningful for semantic content-bottom purposes, but its own
      // border box is not the pagination authority here. Union real child boxes so an
      // Android/WebView wrapper measurement quirk cannot hide the last skill/language row.
      .filter(element => element !== wrapper);
    return rectFromElements(...meaningfulChildren);
  };

  const getFinalSectionsSpacer = (wrapper: HTMLElement): HTMLElement => {
    const previous = wrapper.previousElementSibling;
    if (previous instanceof HTMLElement && previous.getAttribute('data-clean-simple-final-sections-spacer') === 'true') {
      return previous;
    }
    const spacer = document.createElement('div');
    spacer.setAttribute('data-clean-simple-final-sections-spacer', 'true');
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.setProperty('height', '0px');
    spacer.style.setProperty('margin', '0');
    spacer.style.setProperty('padding', '0');
    spacer.style.setProperty('line-height', '0');
    wrapper.parentElement?.insertBefore(spacer, wrapper);
    return spacer;
  };

  const spacerHeightOf = (wrapper: HTMLElement | null): number => {
    const previous = wrapper?.previousElementSibling;
    if (previous instanceof HTMLElement && previous.getAttribute('data-clean-simple-final-sections-spacer') === 'true') {
      return parseCssPx(previous.style.height);
    }
    return 0;
  };

  const setFinalSectionsSpacerHeight = (wrapper: HTMLElement, additionalHeightPx: number): number => {
    const spacer = getFinalSectionsSpacer(wrapper);
    const nextHeightPx = Math.max(0, parseCssPx(spacer.style.height) + additionalHeightPx);
    spacer.style.setProperty('height', `${nextHeightPx}px`);
    return nextHeightPx;
  };

  let finalSectionsDiagnostic: CleanSimpleFinalSectionsPaginationDiagnostic = {
    found: false,
    beforeTop: null,
    beforeBottom: null,
    beforeHeight: null,
    afterTop: null,
    afterBottom: null,
    afterHeight: null,
    pageBoundary: null,
    straddledBefore: false,
    straddlesAfter: false,
    fitsOnContinuationPage: false,
    spacerHeightPx: 0,
    moved: false,
    textPreview: '',
  };

  // Shift `anchor` (a section heading) to the next page boundary when it either straddles
  // a boundary itself, or there isn't enough room left on its current page for
  // `requiredTrailingHeightPx` of content that must stay glued to it.
  const shiftAnchorIfOrphaned = (anchor: HTMLElement, requiredTrailingHeightPx: number | null): boolean => {
    const rect = rectOf(anchor);
    if (!rect || rect.height <= 0) return false;

    const anchorStraddles = rectStraddles(rect);
    const startsOnPage = pageIndexOf(rect.top);
    const pageBottom = (startsOnPage + 1) * pageHeightCssPx;
    const roomAfterAnchor = pageBottom - rect.bottom;
    const wouldOrphanNext = requiredTrailingHeightPx !== null
      && requiredTrailingHeightPx > PDF_PAGE_INTERSECTION_EPSILON_PX
      && roomAfterAnchor + PDF_PAGE_INTERSECTION_EPSILON_PX < requiredTrailingHeightPx;

    if (!anchorStraddles && !wouldOrphanNext) return false;
    if (
      !anchorStraddles
      && requiredTrailingHeightPx !== null
      && (rect.height + requiredTrailingHeightPx) > continuationUsableHeightPx
    ) {
      // Even a fresh page can't hold heading + required content glued together —
      // shifting would just relocate the same overflow, so let it flow naturally.
      return false;
    }

    const shiftPx = Math.max(0, pageBottom - rect.top + CLEAN_SIMPLE_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;
    shiftGroupToNextPage(anchor, shiftPx);
    return true;
  };

  const shiftWholeGroupIfStraddling = (group: HTMLElement, maxHeightPx: number): boolean => {
    const rect = rectOf(group);
    if (!rect || rect.height <= 0 || rect.height > maxHeightPx) return false;
    if (!rectStraddles(rect)) return false;
    const startsOnPage = pageIndexOf(rect.top);
    const nextPageTop = (startsOnPage + 1) * pageHeightCssPx;
    const shiftPx = Math.max(0, nextPageTop - rect.top + CLEAN_SIMPLE_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;
    shiftGroupToNextPage(group, shiftPx);
    return true;
  };

  const shiftAnchorForGroupIfStraddling = (
    anchor: HTMLElement,
    groupRect: { top: number; bottom: number; height: number } | null,
    maxHeightPx: number,
  ): boolean => {
    if (!groupRect || groupRect.height <= 0 || groupRect.height > maxHeightPx) return false;
    if (!rectStraddles(groupRect)) return false;
    const startsOnPage = pageIndexOf(groupRect.top);
    const nextPageTop = (startsOnPage + 1) * pageHeightCssPx;
    const shiftPx = Math.max(0, nextPageTop - groupRect.top + CLEAN_SIMPLE_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;
    shiftGroupToNextPage(anchor, shiftPx);
    return true;
  };

  const shiftFinalSectionsWrapperIfNeeded = (wrapper: HTMLElement): { moved: boolean; fits: boolean } => {
    const beforeRect = finalSectionsChildUnionRect(wrapper);
    const fits = Boolean(beforeRect && beforeRect.height > 0 && beforeRect.height <= continuationUsableHeightPx);
    const straddledBefore = beforeRect ? rectStraddles(beforeRect) : false;
    const pageBoundary = beforeRect ? (pageIndexOf(beforeRect.top) + 1) * pageHeightCssPx : null;
    let moved = false;

    if (finalSectionsDiagnostic.moved && !straddledBefore) {
      finalSectionsDiagnostic = {
        ...finalSectionsDiagnostic,
        afterTop: beforeRect?.top ?? finalSectionsDiagnostic.afterTop,
        afterBottom: beforeRect?.bottom ?? finalSectionsDiagnostic.afterBottom,
        afterHeight: beforeRect?.height ?? finalSectionsDiagnostic.afterHeight,
        straddlesAfter: straddledBefore,
        spacerHeightPx: spacerHeightOf(wrapper),
      };
      return { moved: false, fits };
    }

    finalSectionsDiagnostic = {
      found: true,
      beforeTop: beforeRect?.top ?? null,
      beforeBottom: beforeRect?.bottom ?? null,
      beforeHeight: beforeRect?.height ?? null,
      afterTop: beforeRect?.top ?? null,
      afterBottom: beforeRect?.bottom ?? null,
      afterHeight: beforeRect?.height ?? null,
      pageBoundary,
      straddledBefore,
      straddlesAfter: straddledBefore,
      fitsOnContinuationPage: fits,
      spacerHeightPx: spacerHeightOf(wrapper),
      moved: false,
      textPreview: cleanSimpleTextPreview(wrapper),
    };

    if (beforeRect && fits && straddledBefore && pageBoundary !== null) {
      const shiftPx = Math.max(0, pageBoundary - beforeRect.top + CLEAN_SIMPLE_GROUP_PAGE_PADDING_PX);
      if (shiftPx > PDF_PAGE_INTERSECTION_EPSILON_PX) {
        const spacerHeightPx = setFinalSectionsSpacerHeight(wrapper, shiftPx);
        moved = true;
        void root.offsetHeight;
        const afterRect = finalSectionsChildUnionRect(wrapper);
        finalSectionsDiagnostic = {
          ...finalSectionsDiagnostic,
          afterTop: afterRect?.top ?? null,
          afterBottom: afterRect?.bottom ?? null,
          afterHeight: afterRect?.height ?? null,
          straddlesAfter: afterRect ? rectStraddles(afterRect) : false,
          spacerHeightPx,
          moved: true,
        };
      }
    }

    return { moved, fits };
  };

  // Work Experience needs more than "heading + first entry exists": the entry's header
  // row (title/company/date) plus the first couple of description lines must also stay
  // with the heading — otherwise the heading can end up alone at a page bottom while the
  // entry's title starts the next page with no section heading above it at all.
  const requiredTrailingForSection = (
    sectionKind: string | null,
    firstContent: HTMLElement,
  ): number | null => {
    if (sectionKind === 'experience') {
      const firstEntry = firstContent.matches('[data-export-group="clean-simple-experience"]')
        ? firstContent
        : firstContent.querySelector<HTMLElement>('[data-export-group="clean-simple-experience"]');
      if (!firstEntry) return rectOf(firstContent)?.height ?? null;
      const headerRow = firstEntry.querySelector<HTMLElement>('[data-clean-simple-experience-header]');
      const description = firstEntry.querySelector<HTMLElement>('[data-clean-simple-experience-description]');
      const headerHeight = rectOf(headerRow)?.height ?? 0;
      const descRect = rectOf(description);
      const descAllowance = description && descRect
        ? Math.min(descRect.height, getCleanSimpleLineHeightPx(description) * CLEAN_SIMPLE_EXPERIENCE_REQUIRED_TRAILING_LINES)
        : 0;
      return headerHeight + descAllowance;
    }
    return rectOf(firstContent)?.height ?? null;
  };

  for (let pass = 0; pass < 10; pass += 1) {
    let movedAnyBlock = false;

    // 1. Professional Summary heading must stay glued to (a couple of lines of) its
    //    first paragraph block. Since the summary is now rendered as one flowing
    //    paragraph per real user paragraph break (see clean-simple-pdf-template.ts),
    //    that first block can be very tall — the requirement is deliberately bounded to
    //    a couple of lines (like the Work Experience rule below) rather than the whole
    //    paragraph's height, so a long summary never forces the heading to "require" an
    //    entire page of trailing room.
    const summarySection = root.querySelector<HTMLElement>('[data-clean-simple-section="summary"]');
    if (summarySection) {
      const heading = summarySection.querySelector<HTMLElement>('h2');
      const firstBlock = summarySection.querySelector<HTMLElement>('[data-clean-simple-summary-block]');
      const firstBlockRect = firstBlock ? rectOf(firstBlock) : null;
      const summaryRequiredTrailingPx = firstBlock && firstBlockRect
        ? Math.min(
            firstBlockRect.height,
            getCleanSimpleLineHeightPx(firstBlock) * CLEAN_SIMPLE_SUMMARY_REQUIRED_TRAILING_LINES,
          )
        : null;
      if (heading && firstBlock && shiftAnchorIfOrphaned(heading, summaryRequiredTrailingPx)) {
        movedAnyBlock = true;
      }
    }

    // 2. Final compact sections: Skills and Languages are visually a single short tail
    //    block in Clean Simple. Use the real PDF-template wrapper when present so the
    //    inserted spacer moves the entire block before html2canvas rasterizes it. This
    //    must run before the generic heading+first-child rule below; otherwise that rule
    //    can move only the Skills section first, after which the synthetic combined
    //    group no longer appears to straddle and Android still starts page 3 with
    //    orphaned skill chips.
    const finalSectionsWrapper = root.querySelector<HTMLElement>('[data-clean-simple-final-sections="true"]');
    const skillsSection = root.querySelector<HTMLElement>('[data-clean-simple-section="skills"]');
    const languagesSection = root.querySelector<HTMLElement>('[data-clean-simple-section="languages"]');
    let finalSectionsWrapperFits = false;
    if (finalSectionsWrapper) {
      const finalSectionsResult = shiftFinalSectionsWrapperIfNeeded(finalSectionsWrapper);
      finalSectionsWrapperFits = finalSectionsResult.fits;
      if (finalSectionsResult.moved) movedAnyBlock = true;
    } else if (skillsSection && languagesSection) {
      const finalSectionRect = rectFromElements(skillsSection, languagesSection);
      if (shiftAnchorForGroupIfStraddling(skillsSection, finalSectionRect, continuationUsableHeightPx)) {
        movedAnyBlock = true;
      }
    }
    if (!finalSectionsWrapper || !finalSectionsWrapperFits) {
      if (skillsSection && shiftWholeGroupIfStraddling(skillsSection, continuationUsableHeightPx)) {
        movedAnyBlock = true;
      }
      if (languagesSection && shiftWholeGroupIfStraddling(languagesSection, continuationUsableHeightPx)) {
        movedAnyBlock = true;
      }
    }

    // 3. Every other section heading (Work Experience, Education, Skills, Languages,
    //    Certifications) must stay glued to its first meaningful child.
    const otherSections = Array.from(root.querySelectorAll<HTMLElement>('[data-clean-simple-section]'))
      .filter((section) => {
        if (section.getAttribute('data-clean-simple-section') === 'summary') return false;
        // Final Skills/Languages are handled as a real atomic wrapper above. Letting the
        // generic heading+first-child rule touch descendants afterwards reintroduces the
        // exact Android failure: SKILLS can be handled independently while later skill
        // chips still flow onto page 3.
        if (finalSectionsWrapper?.contains(section)) return false;
        return true;
      });
    for (const section of otherSections) {
      const heading = section.querySelector<HTMLElement>(':scope > h2');
      const firstContent = heading?.nextElementSibling;
      if (!heading || !(firstContent instanceof HTMLElement)) continue;
      const required = requiredTrailingForSection(section.getAttribute('data-clean-simple-section'), firstContent);
      if (shiftAnchorIfOrphaned(heading, required)) movedAnyBlock = true;
    }

    // 4. Summary paragraph blocks: move a whole block to the next page rather than
    //    slicing through it when it straddles the boundary and is short enough to fit.
    //    Bounded by the same short-keep-group ratio used for experience/education
    //    entries below (not the much larger continuation-page budget) — a summary is
    //    now rendered as one flowing paragraph per real user paragraph break, so a
    //    single block can be most of a page tall. Relocating a block that large would
    //    leave the *previous* page almost entirely blank (just the heading) instead of
    //    letting the paragraph naturally fill it and split at a safe rendered line
    //    boundary (see the DOM line-interval-based safe break search in
    //    planCleanSimplePdfSliceSegments), which is what actually produces natural,
    //    professional-looking continuation pages for long summaries.
    const summaryBlocks = summarySection
      ? Array.from(summarySection.querySelectorAll<HTMLElement>('[data-clean-simple-summary-block]'))
      : [];
    for (const block of summaryBlocks) {
      if (shiftWholeGroupIfStraddling(block, maxKeepGroupHeightPx)) movedAnyBlock = true;
    }

    // 5. Individual Work Experience / Education entries: keep each entry whole rather
    //    than letting the canvas slicer cut through the middle of one.
    const experienceEntries = Array.from(root.querySelectorAll<HTMLElement>('[data-export-group="clean-simple-experience"]'));
    for (const entry of experienceEntries) {
      if (shiftWholeGroupIfStraddling(entry, maxKeepGroupHeightPx)) movedAnyBlock = true;
    }
    const educationEntries = Array.from(root.querySelectorAll<HTMLElement>('[data-export-group="clean-simple-education"]'));
    for (const entry of educationEntries) {
      if (shiftWholeGroupIfStraddling(entry, maxKeepGroupHeightPx)) movedAnyBlock = true;
    }

    if (!movedAnyBlock) break;
  }

  const blocks: CleanSimpleBlockDiagnostic[] = [];
  const pushDiagnosticEntry = (
    kind: CleanSimpleBlockKind,
    keepGroupId: string,
    el: HTMLElement,
    rect: { top: number; bottom: number; height: number } | null,
  ): void => {
    const pageBoundary = rect ? (pageIndexOf(rect.top) + 1) * pageHeightCssPx : null;
    blocks.push({
      kind,
      keepGroupId,
      textPreview: cleanSimpleTextPreview(el),
      top: rect?.top ?? null,
      bottom: rect?.bottom ?? null,
      height: rect?.height ?? null,
      pageBoundary,
      straddles: rect ? rectStraddles(rect) : false,
      shifted: parseCssPx(el.style.marginTop) > PDF_PAGE_INTERSECTION_EPSILON_PX,
      appliedMarginTopPx: parseCssPx(el.style.marginTop),
    });
  };
  const pushDiagnostic = (kind: CleanSimpleBlockKind, keepGroupId: string, el: HTMLElement | null | undefined): void => {
    if (!el) return;
    pushDiagnosticEntry(kind, keepGroupId, el, rectOf(el));
  };

  const finalSummarySection = root.querySelector<HTMLElement>('[data-clean-simple-section="summary"]');
  if (finalSummarySection) {
    pushDiagnostic('summary-heading', 'summary', finalSummarySection.querySelector<HTMLElement>('h2'));
    Array.from(finalSummarySection.querySelectorAll<HTMLElement>('[data-clean-simple-summary-block]'))
      .forEach((block, index) => pushDiagnostic('summary-block', `summary-block-${index}`, block));
  }
  Array.from(root.querySelectorAll<HTMLElement>('[data-clean-simple-section]'))
    .filter(section => section.getAttribute('data-clean-simple-section') !== 'summary')
    .forEach((section) => {
      const sectionKind = section.getAttribute('data-clean-simple-section') ?? 'section';
      pushDiagnostic('section-heading', sectionKind, section.querySelector<HTMLElement>(':scope > h2'));
    });
  const finalSkillsSection = root.querySelector<HTMLElement>('[data-clean-simple-section="skills"]');
  const finalLanguagesSection = root.querySelector<HTMLElement>('[data-clean-simple-section="languages"]');
  const finalSectionsDiagnosticWrapper = root.querySelector<HTMLElement>('[data-clean-simple-final-sections="true"]');
  if (finalSectionsDiagnosticWrapper) {
    pushDiagnostic('final-section-group', 'skills-languages', finalSectionsDiagnosticWrapper);
  } else if (finalSkillsSection && finalLanguagesSection) {
    pushDiagnosticEntry(
      'final-section-group',
      'skills-languages',
      finalSkillsSection,
      rectFromElements(finalSkillsSection, finalLanguagesSection),
    );
  }
  Array.from(root.querySelectorAll<HTMLElement>('[data-export-group="clean-simple-experience"]'))
    .forEach((entry, index) => pushDiagnostic('experience-entry', `experience-entry-${index}`, entry));
  Array.from(root.querySelectorAll<HTMLElement>('[data-export-group="clean-simple-education"]'))
    .forEach((entry, index) => pushDiagnostic('education-entry', `education-entry-${index}`, entry));

  return {
    pageHeightCssPx,
    topInsetCssPx: CLEAN_SIMPLE_PDF_PAGE_TOP_INSET_CSS_PX,
    bottomInsetCssPx: CLEAN_SIMPLE_PDF_PAGE_BOTTOM_INSET_CSS_PX,
    blockCount: blocks.length,
    blocks,
    finalSections: finalSectionsDiagnostic,
  };
}

export function collectTechSidebarMainColumnTextLineIntervalsCss(
  root: HTMLElement,
): ElegantFormalTextLineIntervalCss[] {
  const main = root.querySelector<HTMLElement>('[data-tech-sidebar-pdf-main]');
  if (!main) return [];

  void root.offsetHeight;
  void main.offsetHeight;

  const mainTopOffsetCssPx = (() => {
    const mainOffset = getRelativeOffsetRect(root, main);
    if (mainOffset) return mainOffset.top;
    const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
    const mainRect = getPositiveRect(main.getBoundingClientRect(), main);
    if (rootRect && mainRect) return mainRect.top - rootRect.top;
    return 0;
  })();

  const mainIntervals = collectTechSidebarMainColumnTextLineIntervalsFromMain(main);
  return mainIntervals.map(interval => ({
    topCssPx: interval.topCssPx + mainTopOffsetCssPx,
    bottomCssPx: interval.bottomCssPx + mainTopOffsetCssPx,
  }));
}

function parseTechSidebarCssLineHeightPx(element: HTMLElement): number {
  const style = window.getComputedStyle(element);
  const fontSize = Number.parseFloat(style.fontSize) || 11;
  const lineHeightRaw = style.lineHeight;
  if (lineHeightRaw.endsWith('px')) {
    const parsed = Number.parseFloat(lineHeightRaw);
    return Number.isFinite(parsed) ? parsed : fontSize * 1.35;
  }
  if (lineHeightRaw === 'normal') return fontSize * 1.35;
  const parsed = Number.parseFloat(lineHeightRaw);
  return Number.isFinite(parsed) ? parsed * fontSize : fontSize * 1.35;
}

function synthesizeTechSidebarTextLineIntervalsFromElement(
  root: HTMLElement,
  element: HTMLElement,
): ElegantFormalTextLineIntervalCss[] {
  const blockRect = getRelativeExportRect({ top: 0 }, element, root);
  if (!blockRect || blockRect.height <= PDF_PAGE_INTERSECTION_EPSILON_PX) return [];

  const lineHeightPx = Math.max(parseTechSidebarCssLineHeightPx(element), 8);
  const intervals: ElegantFormalTextLineIntervalCss[] = [];
  for (let lineTop = blockRect.top; lineTop < blockRect.bottom - 1; lineTop += lineHeightPx) {
    const lineBottom = Math.min(blockRect.bottom, lineTop + lineHeightPx * 0.92);
    if (lineBottom > lineTop + 2) {
      intervals.push({ topCssPx: lineTop, bottomCssPx: lineBottom });
    }
  }
  return intervals;
}

function collectTechSidebarMainColumnTextLineIntervalsFromMain(
  main: HTMLElement,
): ElegantFormalTextLineIntervalCss[] {
  void main.offsetHeight;
  const mainBox = getPositiveRect(main.getBoundingClientRect(), main);
  const mainTop = mainBox?.top ?? 0;
  const intervals: ElegantFormalTextLineIntervalCss[] = [];
  const synthesizedParents = new Set<HTMLElement>();
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;

  while (node) {
    const text = node.textContent ?? '';
    if (!text.trim()) {
      node = walker.nextNode() as Text | null;
      continue;
    }

    const parentEl = node.parentElement;
    if (!parentEl) {
      node = walker.nextNode() as Text | null;
      continue;
    }

    const range = document.createRange();
    range.selectNodeContents(node);
    let rects: DOMRect[] = [];
    if (typeof range.getClientRects === 'function') {
      rects = Array.from(range.getClientRects()).filter(
        rect => rect.width > 0 && rect.height > PDF_PAGE_INTERSECTION_EPSILON_PX,
      );
    }

    let addedRects = false;
    for (const rect of rects) {
      const topCssPx = rect.top - mainTop;
      const bottomCssPx = rect.bottom - mainTop;
      if (bottomCssPx <= topCssPx + PDF_PAGE_INTERSECTION_EPSILON_PX) continue;
      if (Math.abs(topCssPx) < PDF_PAGE_INTERSECTION_EPSILON_PX && Math.abs(bottomCssPx) < PDF_PAGE_INTERSECTION_EPSILON_PX) {
        continue;
      }
      intervals.push({ topCssPx, bottomCssPx });
      addedRects = true;
    }

    if (!addedRects && !synthesizedParents.has(parentEl)) {
      synthesizedParents.add(parentEl);
      intervals.push(...synthesizeTechSidebarTextLineIntervalsFromElement(main, parentEl));
    }

    node = walker.nextNode() as Text | null;
  }

  return mergeElegantFormalTextLineIntervals(intervals);
}

function isTechSidebarMainColumnCanvasRowInk(
  canvas: HTMLCanvasElement,
  rowY: number,
  contentLeftPx: number,
  contentRightPx: number,
): boolean {
  const rows = analyzeElegantFormalCanvasWhitespaceRows(
    canvas,
    rowY,
    rowY,
    contentLeftPx,
    contentRightPx,
  );
  return rows.length === 0 || !rows[0];
}

// Build line intervals from the rendered html2canvas bitmap in the main column only.
// This is the most reliable source on Android WebView where pre-capture DOM line boxes
// are often block-level, zero-sized, or missing for off-screen export roots.
export function extractTechSidebarMainColumnInkLineIntervalsFromCanvas(
  canvas: HTMLCanvasElement,
  contentLeftPx: number,
  contentRightPx: number,
): Array<{ top: number; bottom: number }> {
  const intervals: Array<{ top: number; bottom: number }> = [];
  let inkStart: number | null = null;

  for (let y = 0; y < canvas.height; y += 1) {
    const isInk = isTechSidebarMainColumnCanvasRowInk(canvas, y, contentLeftPx, contentRightPx);
    if (isInk) {
      if (inkStart === null) inkStart = y;
    } else if (inkStart !== null) {
      intervals.push({ top: inkStart, bottom: y });
      inkStart = null;
    }
  }
  if (inkStart !== null) intervals.push({ top: inkStart, bottom: canvas.height });

  const merged: Array<{ top: number; bottom: number }> = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && interval.top - last.bottom <= 3) {
      last.bottom = Math.max(last.bottom, interval.bottom);
    } else {
      merged.push({ top: interval.top, bottom: interval.bottom });
    }
  }
  return merged;
}

export function selectTechSidebarPdfLineIntervalsCanvas(
  domIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
  domIntervalsReliable: boolean,
  canvasInkIntervalsCanvasPx: Array<{ top: number; bottom: number }>,
): {
  intervals: Array<{ top: number; bottom: number }> | null;
  reliable: boolean;
  source: 'canvas' | 'dom' | 'none';
} {
  if (canvasInkIntervalsCanvasPx.length >= 3) {
    return {
      intervals: canvasInkIntervalsCanvasPx,
      reliable: true,
      source: 'canvas',
    };
  }
  if (domIntervalsCanvasPx && domIntervalsCanvasPx.length > 0 && domIntervalsReliable) {
    return {
      intervals: domIntervalsCanvasPx,
      reliable: true,
      source: 'dom',
    };
  }
  if (domIntervalsCanvasPx && domIntervalsCanvasPx.length > 0) {
    return {
      intervals: domIntervalsCanvasPx,
      reliable: false,
      source: 'dom',
    };
  }
  if (canvasInkIntervalsCanvasPx.length > 0) {
    return {
      intervals: canvasInkIntervalsCanvasPx,
      reliable: true,
      source: 'canvas',
    };
  }
  return { intervals: null, reliable: false, source: 'none' };
}

export function getTechSidebarMainColumnContentBoundsCss(
  root: HTMLElement,
): { leftCssPx: number; rightCssPx: number } {
  const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
  const rootWidth = rootRect?.width || root.offsetWidth || root.scrollWidth;
  const fallbackLeft = rootWidth * (TECH_SIDEBAR_SIDEBAR_WIDTH_MM / CV_PDF_A4_WIDTH_MM);

  const main = root.querySelector<HTMLElement>('[data-tech-sidebar-pdf-main]');
  if (!main || rootWidth <= 0) {
    return { leftCssPx: fallbackLeft + 2, rightCssPx: Math.max(fallbackLeft + 4, rootWidth - 2) };
  }

  const rootDomRect = root.getBoundingClientRect();
  const mainDomRect = main.getBoundingClientRect();
  const measuredLeft = mainDomRect.left - rootDomRect.left + 2;
  const measuredRight = mainDomRect.right - rootDomRect.left - 2;
  if (
    mainDomRect.width > PDF_PAGE_INTERSECTION_EPSILON_PX
    && measuredRight > measuredLeft + 8
    && measuredLeft >= fallbackLeft * 0.85
  ) {
    return {
      leftCssPx: Math.max(0, measuredLeft),
      rightCssPx: Math.min(rootWidth, measuredRight),
    };
  }

  return { leftCssPx: fallbackLeft + 2, rightCssPx: Math.max(fallbackLeft + 4, rootWidth - 2) };
}

export function scaleTechSidebarMainColumnBoundsToCanvas(
  boundsCss: { leftCssPx: number; rightCssPx: number },
  canvasWidthPx: number,
  cssWidthPx: number,
): { contentLeftPx: number; contentRightPx: number } {
  if (cssWidthPx <= 0 || canvasWidthPx <= 0) {
    const fallbackLeft = Math.floor(canvasWidthPx * (TECH_SIDEBAR_SIDEBAR_WIDTH_MM / CV_PDF_A4_WIDTH_MM));
    return { contentLeftPx: fallbackLeft, contentRightPx: canvasWidthPx };
  }
  const scalePxPerCssPx = canvasWidthPx / cssWidthPx;
  return {
    contentLeftPx: Math.max(0, Math.floor(boundsCss.leftCssPx * scalePxPerCssPx)),
    contentRightPx: Math.min(canvasWidthPx, Math.ceil(boundsCss.rightCssPx * scalePxPerCssPx)),
  };
}

export function resolveTechSidebarSafePageBreakCanvasPx(
  canvas: HTMLCanvasElement,
  domLineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
  domIntervalsReliable: boolean,
  targetBreakPx: number,
  guardPx: number,
  domSearchPx: number,
  canvasSearchPx: number,
  minBreakPx: number,
  contentLeftPx: number,
  contentRightPx: number,
): ElegantFormalPageBreakResolution {
  const nominalBreakPx = Math.floor(targetBreakPx);
  let breakPx = nominalBreakPx;
  let source: ElegantFormalPageBreakResolution['source'] = 'nominal';

  const nominalCutsInk = !isElegantFormalCanvasBreakRowWhitespace(
    canvas,
    nominalBreakPx,
    contentLeftPx,
    contentRightPx,
  );

  if (domIntervalsReliable && domLineIntervalsCanvasPx && domLineIntervalsCanvasPx.length > 0) {
    const domBreakPx = findSafeElegantFormalPageBreakCanvasPx(
      domLineIntervalsCanvasPx,
      targetBreakPx,
      guardPx,
      domSearchPx,
    );
    if (domBreakPx !== nominalBreakPx) {
      breakPx = domBreakPx;
      source = 'dom';
    }
  }

  const domBreakStillCutsInk = !isElegantFormalCanvasBreakRowWhitespace(
    canvas,
    breakPx,
    contentLeftPx,
    contentRightPx,
  );
  const needsCanvasFallback = source === 'nominal'
    || nominalCutsInk
    || !domIntervalsReliable
    || !domLineIntervalsCanvasPx
    || domLineIntervalsCanvasPx.length === 0
    || domBreakStillCutsInk;

  if (needsCanvasFallback) {
    const canvasBreakPx = findSafeElegantFormalPageBreakFromCanvasPixels(
      canvas,
      targetBreakPx,
      guardPx,
      canvasSearchPx,
      minBreakPx,
      contentLeftPx,
      contentRightPx,
    );
    if (
      canvasBreakPx !== nominalBreakPx
      || nominalCutsInk
      || domBreakStillCutsInk
      || !isElegantFormalCanvasBreakRowWhitespace(canvas, breakPx, contentLeftPx, contentRightPx)
    ) {
      breakPx = canvasBreakPx;
      source = 'canvas';
    }
  }

  if (breakPx <= minBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX) {
    breakPx = Math.max(minBreakPx + 1, nominalBreakPx);
    source = nominalBreakPx === breakPx ? 'nominal' : source;
  }

  if (
    domLineIntervalsCanvasPx
    && domLineIntervalsCanvasPx.length > 0
    && isUnsafeElegantFormalPageBreakCanvasPx(breakPx, domLineIntervalsCanvasPx, guardPx)
  ) {
    const forcedDomBreakPx = findSafeElegantFormalPageBreakCanvasPx(
      domLineIntervalsCanvasPx,
      targetBreakPx,
      guardPx,
      domSearchPx,
    );
    if (
      forcedDomBreakPx !== nominalBreakPx
      && forcedDomBreakPx > minBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX
      && !isUnsafeElegantFormalPageBreakCanvasPx(forcedDomBreakPx, domLineIntervalsCanvasPx, guardPx)
    ) {
      breakPx = forcedDomBreakPx;
      source = 'dom';
    }
  }

  if (!isElegantFormalCanvasBreakRowWhitespace(canvas, breakPx, contentLeftPx, contentRightPx)) {
    const forcedCanvasBreakPx = findSafeElegantFormalPageBreakFromCanvasPixels(
      canvas,
      targetBreakPx,
      guardPx,
      canvasSearchPx,
      minBreakPx,
      contentLeftPx,
      contentRightPx,
    );
    if (
      forcedCanvasBreakPx !== nominalBreakPx
      && forcedCanvasBreakPx > minBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX
      && isElegantFormalCanvasBreakRowWhitespace(canvas, forcedCanvasBreakPx, contentLeftPx, contentRightPx)
    ) {
      breakPx = forcedCanvasBreakPx;
      source = 'canvas';
    }
  }

  return { breakPx, source };
}

export type TechSidebarPdfSliceSegment = ElegantFormalPdfSliceSegment;

export function planTechSidebarPdfSliceSegments(
  canvasHeightPx: number,
  pageHeightPx: number,
  trailingTolerancePx: number,
  pdfCanvas: HTMLCanvasElement,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
  domIntervalsReliable: boolean,
  guardCanvasPx: number,
  domSearchCanvasPx: number,
  canvasSearchCanvasPx: number,
  contentLeftPx: number,
  contentRightPx: number,
  breakSourcesOut: string[],
): TechSidebarPdfSliceSegment[] {
  const segments: TechSidebarPdfSliceSegment[] = [];
  let offsetY = 0;

  while (offsetY < canvasHeightPx - trailingTolerancePx) {
    let sliceHeight = Math.min(pageHeightPx, canvasHeightPx - offsetY);
    let breakSource: ElegantFormalPageBreakResolution['source'] = 'nominal';

    if (
      sliceHeight >= pageHeightPx - PDF_PAGE_INTERSECTION_EPSILON_PX
      && offsetY + pageHeightPx < canvasHeightPx - trailingTolerancePx
    ) {
      const targetBreakPx = offsetY + pageHeightPx;
      const breakResolution = resolveTechSidebarSafePageBreakCanvasPx(
        pdfCanvas,
        lineIntervalsCanvasPx,
        domIntervalsReliable,
        targetBreakPx,
        guardCanvasPx,
        domSearchCanvasPx,
        canvasSearchCanvasPx,
        offsetY,
        contentLeftPx,
        contentRightPx,
      );
      breakSource = breakResolution.source;
      breakSourcesOut.push(breakResolution.source);
      if (breakResolution.breakPx > offsetY + PDF_PAGE_INTERSECTION_EPSILON_PX) {
        sliceHeight = breakResolution.breakPx - offsetY;
      }
    }

    segments.push({ startPx: offsetY, endPx: offsetY + sliceHeight, breakSource });
    offsetY += sliceHeight;
  }

  return segments;
}

function getRirekishoCanvasScanBounds(
  contentLeftPx: number,
  contentRightPx: number,
): { contentLeftPx: number; contentRightPx: number } {
  const bandWidth = Math.max(0, contentRightPx - contentLeftPx);
  const innerInsetPx = Math.max(8, Math.floor(bandWidth * RIREKISHO_CANVAS_CONTENT_SAMPLE_INSET_RATIO));
  return {
    contentLeftPx: contentLeftPx + innerInsetPx,
    contentRightPx: Math.max(contentLeftPx + innerInsetPx + 1, contentRightPx - innerInsetPx),
  };
}

function isRirekishoCanvasBreakRowWhitespace(
  canvas: HTMLCanvasElement,
  breakPx: number,
  contentLeftPx: number,
  contentRightPx: number,
): boolean {
  const scanBounds = getRirekishoCanvasScanBounds(contentLeftPx, contentRightPx);
  return isElegantFormalCanvasBreakRowWhitespace(
    canvas,
    breakPx,
    scanBounds.contentLeftPx,
    scanBounds.contentRightPx,
  );
}

function isRirekishoCanvasRowInk(
  canvas: HTMLCanvasElement,
  rowY: number,
  contentLeftPx: number,
  contentRightPx: number,
): boolean {
  return !isRirekishoCanvasBreakRowWhitespace(canvas, rowY, contentLeftPx, contentRightPx);
}

export function getRirekishoPdfContentBoundsCss(
  root: HTMLElement,
): { leftCssPx: number; rightCssPx: number } {
  const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
  const rootWidth = rootRect?.width || root.offsetWidth || root.scrollWidth;
  const pad = RIREKISHO_PDF_HORIZONTAL_PADDING_CSS_PX;
  if (rootWidth <= 0) {
    return { leftCssPx: pad + 2, rightCssPx: pad + 4 };
  }
  return {
    leftCssPx: pad + 2,
    rightCssPx: Math.max(pad + 4, rootWidth - pad - 2),
  };
}

export function scaleRirekishoContentBoundsToCanvas(
  boundsCss: { leftCssPx: number; rightCssPx: number },
  canvasWidthPx: number,
  cssWidthPx: number,
): { contentLeftPx: number; contentRightPx: number } {
  if (cssWidthPx <= 0 || canvasWidthPx <= 0) {
    const fallbackPad = Math.floor(canvasWidthPx * (RIREKISHO_PDF_HORIZONTAL_PADDING_CSS_PX / 794));
    return { contentLeftPx: fallbackPad, contentRightPx: canvasWidthPx - fallbackPad };
  }
  const scalePxPerCssPx = canvasWidthPx / cssWidthPx;
  return {
    contentLeftPx: Math.max(0, Math.floor(boundsCss.leftCssPx * scalePxPerCssPx)),
    contentRightPx: Math.min(canvasWidthPx, Math.ceil(boundsCss.rightCssPx * scalePxPerCssPx)),
  };
}

export function extractRirekishoInkLineIntervalsFromCanvas(
  canvas: HTMLCanvasElement,
  contentLeftPx: number,
  contentRightPx: number,
): Array<{ top: number; bottom: number }> {
  const intervals: Array<{ top: number; bottom: number }> = [];
  let inkStart: number | null = null;

  for (let y = 0; y < canvas.height; y += 1) {
    const isInk = isRirekishoCanvasRowInk(canvas, y, contentLeftPx, contentRightPx);
    if (isInk) {
      if (inkStart === null) inkStart = y;
    } else if (inkStart !== null) {
      intervals.push({ top: inkStart, bottom: y });
      inkStart = null;
    }
  }
  if (inkStart !== null) intervals.push({ top: inkStart, bottom: canvas.height });

  const merged: Array<{ top: number; bottom: number }> = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (last && interval.top - last.bottom <= 3) {
      last.bottom = Math.max(last.bottom, interval.bottom);
    } else {
      merged.push({ top: interval.top, bottom: interval.bottom });
    }
  }
  return merged;
}

export function selectRirekishoPdfLineIntervalsCanvas(
  domIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
  domIntervalsReliable: boolean,
  canvasInkIntervalsCanvasPx: Array<{ top: number; bottom: number }>,
): {
  intervals: Array<{ top: number; bottom: number }> | null;
  reliable: boolean;
  source: 'canvas' | 'dom' | 'none';
} {
  if (canvasInkIntervalsCanvasPx.length >= 3) {
    return {
      intervals: canvasInkIntervalsCanvasPx,
      reliable: true,
      source: 'canvas',
    };
  }
  if (domIntervalsCanvasPx && domIntervalsCanvasPx.length > 0 && domIntervalsReliable) {
    return {
      intervals: domIntervalsCanvasPx,
      reliable: true,
      source: 'dom',
    };
  }
  if (domIntervalsCanvasPx && domIntervalsCanvasPx.length > 0) {
    return {
      intervals: domIntervalsCanvasPx,
      reliable: false,
      source: 'dom',
    };
  }
  if (canvasInkIntervalsCanvasPx.length > 0) {
    return {
      intervals: canvasInkIntervalsCanvasPx,
      reliable: true,
      source: 'canvas',
    };
  }
  return { intervals: null, reliable: false, source: 'none' };
}

export function resolveRirekishoSafePageBreakCanvasPx(
  canvas: HTMLCanvasElement,
  domLineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
  domIntervalsReliable: boolean,
  targetBreakPx: number,
  guardPx: number,
  domSearchPx: number,
  canvasSearchPx: number,
  minBreakPx: number,
  contentLeftPx: number,
  contentRightPx: number,
): ElegantFormalPageBreakResolution {
  const scanBounds = getRirekishoCanvasScanBounds(contentLeftPx, contentRightPx);
  const nominalBreakPx = Math.floor(targetBreakPx);
  let breakPx = nominalBreakPx;
  let source: ElegantFormalPageBreakResolution['source'] = 'nominal';

  const nominalCutsInk = !isRirekishoCanvasBreakRowWhitespace(
    canvas,
    nominalBreakPx,
    contentLeftPx,
    contentRightPx,
  );

  if (domIntervalsReliable && domLineIntervalsCanvasPx && domLineIntervalsCanvasPx.length > 0) {
    const domBreakPx = findSafeElegantFormalPageBreakCanvasPx(
      domLineIntervalsCanvasPx,
      targetBreakPx,
      guardPx,
      domSearchPx,
    );
    if (domBreakPx !== nominalBreakPx) {
      breakPx = domBreakPx;
      source = 'dom';
    }
  }

  const domBreakStillCutsInk = !isRirekishoCanvasBreakRowWhitespace(
    canvas,
    breakPx,
    contentLeftPx,
    contentRightPx,
  );
  const needsCanvasFallback = source === 'nominal'
    || nominalCutsInk
    || !domIntervalsReliable
    || !domLineIntervalsCanvasPx
    || domLineIntervalsCanvasPx.length === 0
    || domBreakStillCutsInk;

  if (needsCanvasFallback) {
    const canvasBreakPx = findSafeElegantFormalPageBreakFromCanvasPixels(
      canvas,
      targetBreakPx,
      guardPx,
      canvasSearchPx,
      minBreakPx,
      scanBounds.contentLeftPx,
      scanBounds.contentRightPx,
    );
    if (
      canvasBreakPx !== nominalBreakPx
      || nominalCutsInk
      || domBreakStillCutsInk
      || !isRirekishoCanvasBreakRowWhitespace(canvas, breakPx, contentLeftPx, contentRightPx)
    ) {
      breakPx = canvasBreakPx;
      source = 'canvas';
    }
  }

  if (breakPx <= minBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX) {
    breakPx = Math.max(minBreakPx + 1, nominalBreakPx);
    source = nominalBreakPx === breakPx ? 'nominal' : source;
  }

  if (
    domLineIntervalsCanvasPx
    && domLineIntervalsCanvasPx.length > 0
    && isUnsafeElegantFormalPageBreakCanvasPx(breakPx, domLineIntervalsCanvasPx, guardPx)
  ) {
    const forcedDomBreakPx = findSafeElegantFormalPageBreakCanvasPx(
      domLineIntervalsCanvasPx,
      targetBreakPx,
      guardPx,
      domSearchPx,
    );
    if (
      forcedDomBreakPx !== nominalBreakPx
      && forcedDomBreakPx > minBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX
      && !isUnsafeElegantFormalPageBreakCanvasPx(forcedDomBreakPx, domLineIntervalsCanvasPx, guardPx)
    ) {
      breakPx = forcedDomBreakPx;
      source = 'dom';
    }
  }

  if (!isRirekishoCanvasBreakRowWhitespace(canvas, breakPx, contentLeftPx, contentRightPx)) {
    const forcedCanvasBreakPx = findSafeElegantFormalPageBreakFromCanvasPixels(
      canvas,
      targetBreakPx,
      guardPx,
      canvasSearchPx,
      minBreakPx,
      scanBounds.contentLeftPx,
      scanBounds.contentRightPx,
    );
    if (
      forcedCanvasBreakPx !== nominalBreakPx
      && forcedCanvasBreakPx > minBreakPx + PDF_PAGE_INTERSECTION_EPSILON_PX
      && isRirekishoCanvasBreakRowWhitespace(canvas, forcedCanvasBreakPx, contentLeftPx, contentRightPx)
    ) {
      breakPx = forcedCanvasBreakPx;
      source = 'canvas';
    }
  }

  return { breakPx, source };
}

export type RirekishoPdfSliceSegment = ElegantFormalPdfSliceSegment;

export function rebalanceRirekishoSparseTrailingPdfSliceSegments(
  segments: RirekishoPdfSliceSegment[],
  pageHeightPx: number,
  trailingTolerancePx: number,
): RirekishoPdfSliceSegment[] {
  return rebalanceElegantFormalSparseTrailingPdfSliceSegments(
    segments,
    pageHeightPx,
    trailingTolerancePx,
    null,
  );
}

function getRirekishoTextLineIntervalsInElement(
  root: HTMLElement,
  rootBox: { top: number },
  element: HTMLElement,
): ElegantFormalTextLineIntervalCss[] {
  const elementRect = getRelativeExportRect(rootBox, element, root);
  if (!elementRect) return [];

  return collectElegantFormalTextLineIntervalsCss(root).filter(
    interval => interval.bottomCssPx > elementRect.top + PDF_PAGE_INTERSECTION_EPSILON_PX
      && interval.topCssPx < elementRect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX,
  );
}

function getRirekishoRequiredTrailingHeight(
  root: HTMLElement,
  rootBox: { top: number },
  firstContent: HTMLElement,
): number | null {
  const firstContentRect = getRelativeExportRect(rootBox, firstContent, root);
  if (!firstContentRect) return null;

  if (firstContent.matches('[data-rirekisho-summary-row="true"]')) {
    const lineIntervals = getRirekishoTextLineIntervalsInElement(root, rootBox, firstContent);
    const reliableLineIntervals = lineIntervals.filter(
      interval => (interval.bottomCssPx - interval.topCssPx) <= ELEGANT_FORMAL_DOM_LINE_MAX_HEIGHT_CSS_PX,
    );
    if (reliableLineIntervals.length > 0) {
      const keepLines = reliableLineIntervals.slice(0, RIREKISHO_SELF_PR_MAX_KEEP_LINES);
      const lastLine = keepLines[keepLines.length - 1];
      return lastLine.bottomCssPx - firstContentRect.top + RIREKISHO_PAGE_BREAK_GUARD_PX;
    }
    const estimatedTwoLineHeight = 10.5 * 1.38 * RIREKISHO_SELF_PR_MAX_KEEP_LINES;
    return Math.min(firstContentRect.height, estimatedTwoLineHeight) + RIREKISHO_PAGE_BREAK_GUARD_PX;
  }

  const firstBullet = firstContent.querySelector<HTMLElement>('[data-rirekisho-bullet-row="true"]');
  if (firstBullet) {
    const bulletRect = getRelativeExportRect(rootBox, firstBullet, root);
    if (bulletRect && bulletRect.bottom > firstContentRect.top) {
      return bulletRect.bottom - firstContentRect.top;
    }
  }

  const firstMeaningful = firstContent.querySelector<HTMLElement>('[data-export-meaningful="true"]');
  if (firstMeaningful && firstMeaningful !== firstContent) {
    const meaningfulRect = getRelativeExportRect(rootBox, firstMeaningful, root);
    if (meaningfulRect && meaningfulRect.bottom > firstContentRect.top) {
      return meaningfulRect.bottom - firstContentRect.top;
    }
  }

  return firstContentRect.height;
}

export function planRirekishoPdfSliceSegments(
  canvasHeightPx: number,
  pageHeightPx: number,
  trailingTolerancePx: number,
  pdfCanvas: HTMLCanvasElement,
  lineIntervalsCanvasPx: Array<{ top: number; bottom: number }> | null,
  domIntervalsReliable: boolean,
  guardCanvasPx: number,
  domSearchCanvasPx: number,
  canvasSearchCanvasPx: number,
  contentLeftPx: number,
  contentRightPx: number,
  breakSourcesOut: string[],
): RirekishoPdfSliceSegment[] {
  const segments: RirekishoPdfSliceSegment[] = [];
  let offsetY = 0;

  while (offsetY < canvasHeightPx - trailingTolerancePx) {
    let sliceHeight = Math.min(pageHeightPx, canvasHeightPx - offsetY);
    let breakSource: ElegantFormalPageBreakResolution['source'] = 'nominal';

    if (
      sliceHeight >= pageHeightPx - PDF_PAGE_INTERSECTION_EPSILON_PX
      && offsetY + pageHeightPx < canvasHeightPx - trailingTolerancePx
    ) {
      const targetBreakPx = offsetY + pageHeightPx;
      const breakResolution = resolveRirekishoSafePageBreakCanvasPx(
        pdfCanvas,
        lineIntervalsCanvasPx,
        domIntervalsReliable,
        targetBreakPx,
        guardCanvasPx,
        domSearchCanvasPx,
        canvasSearchCanvasPx,
        offsetY,
        contentLeftPx,
        contentRightPx,
      );
      breakSource = breakResolution.source;
      breakSourcesOut.push(breakResolution.source);
      if (breakResolution.breakPx > offsetY + PDF_PAGE_INTERSECTION_EPSILON_PX) {
        sliceHeight = breakResolution.breakPx - offsetY;
      }
    }

    segments.push({ startPx: offsetY, endPx: offsetY + sliceHeight, breakSource });
    offsetY += sliceHeight;
  }

  return rebalanceRirekishoSparseTrailingPdfSliceSegments(
    segments,
    pageHeightPx,
    trailingTolerancePx,
  );
}

function getRirekishoSectionFirstContentElement(section: HTMLElement): HTMLElement | null {
  const table = section.querySelector<HTMLElement>(':scope > table');
  if (!table) return null;
  const meaningfulRow = table.querySelector<HTMLElement>('tr[data-export-meaningful="true"]');
  if (meaningfulRow) return meaningfulRow;
  const rows = Array.from(table.querySelectorAll<HTMLElement>('tr'));
  return rows[1] ?? rows[0] ?? null;
}

export function applyRirekishoKeepTogetherPagination(root: HTMLElement): void {
  void root.offsetHeight;
  const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
  const rootWidth = rootRect?.width || root.offsetWidth || root.scrollWidth;
  if (rootWidth <= 0) return;

  const rootBox = { top: rootRect?.top ?? 0 };
  const pageHeightCssPx = rootWidth * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return;

  const maxShortGroupHeight = pageHeightCssPx * RIREKISHO_MAX_KEEP_GROUP_PAGE_RATIO;
  const maxExperienceUnitHeight = pageHeightCssPx * RIREKISHO_EXPERIENCE_MAX_KEEP_UNIT_PAGE_RATIO;

  const shiftHeaderIfNeeded = (header: HTMLElement, requiredTrailingHeight: number | null): boolean => {
    const rect = getRelativeExportRect(rootBox, header, root);
    if (!rect || rect.height <= 0) return false;

    const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const headerItselfStraddles = startsOnPage !== endsOnPage;

    const pageBottom = (startsOnPage + 1) * pageHeightCssPx;
    const roomAfterHeader = pageBottom - rect.bottom;
    const wouldOrphanHeading = requiredTrailingHeight !== null
      && requiredTrailingHeight > 0
      && roomAfterHeader + PDF_PAGE_INTERSECTION_EPSILON_PX < requiredTrailingHeight;

    if (!headerItselfStraddles && !wouldOrphanHeading) return false;

    const shiftPx = Math.max(0, pageBottom - rect.top + RIREKISHO_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    shiftGroupToNextPage(header, shiftPx);
    return true;
  };

  const shiftIfStraddling = (el: HTMLElement, maxHeight: number): boolean => {
    if (el.matches('[data-rirekisho-summary-row="true"]')) return false;

    const rect = getRelativeExportRect(rootBox, el, root);
    if (!rect || rect.height <= 0 || rect.height >= maxHeight) return false;

    const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    if (startsOnPage === endsOnPage) return false;

    const nextPageTop = (startsOnPage + 1) * pageHeightCssPx;
    const shiftPx = Math.max(0, nextPageTop - rect.top + RIREKISHO_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    shiftGroupToNextPage(el, shiftPx);
    return true;
  };

  for (let pass = 0; pass < 8; pass += 1) {
    let movedAnyGroup = false;

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-export-group="rirekisho-section"]'));
    for (const section of sections) {
      const heading = section.querySelector<HTMLElement>(':scope > h2');
      if (!heading || section.firstElementChild !== heading) continue;

      const firstContent = getRirekishoSectionFirstContentElement(section);
      if (!firstContent) continue;

      const requiredTrailingHeight = getRirekishoRequiredTrailingHeight(root, rootBox, firstContent);
      if (shiftHeaderIfNeeded(heading, requiredTrailingHeight)) movedAnyGroup = true;
    }

    const bulletRows = Array.from(root.querySelectorAll<HTMLElement>('[data-rirekisho-bullet-row="true"]'));
    for (const bullet of bulletRows) {
      if (shiftIfStraddling(bullet, maxExperienceUnitHeight)) movedAnyGroup = true;
    }

    const tableRows = Array.from(root.querySelectorAll<HTMLElement>('tr[data-export-meaningful="true"]'));
    for (const row of tableRows) {
      if (row.matches('[data-rirekisho-summary-row="true"]')) continue;
      if (shiftIfStraddling(row, maxShortGroupHeight)) movedAnyGroup = true;
    }

    if (!movedAnyGroup) break;
  }

  applyRirekishoSelfPrPageBalance(root);
}

export function applyRirekishoSelfPrPageBalance(root: HTMLElement): void {
  void root.offsetHeight;
  const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
  if (!rootRect || rootRect.width <= 0) return;

  const rootBox = { top: rootRect.top ?? 0 };
  const pageHeightCssPx = rootRect.width * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return;

  const selfPrSection = root.querySelector<HTMLElement>('[data-rirekisho-section-kind="self-pr"]');
  if (!selfPrSection) return;

  const heading = selfPrSection.querySelector<HTMLElement>('h2');
  const summaryRow = selfPrSection.querySelector<HTMLElement>('[data-rirekisho-summary-row="true"]');
  if (!heading || !summaryRow) return;

  const headingMargin = parseCssPx(heading.style.marginTop);
  if (headingMargin <= PDF_PAGE_INTERSECTION_EPSILON_PX) return;

  const headingRect = getRelativeExportRect(rootBox, heading, root);
  if (!headingRect) return;

  const headingPage = Math.floor((headingRect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
  if (headingPage < 1) return;

  const prevPageBottom = headingPage * pageHeightCssPx;
  const prevPageTop = (headingPage - 1) * pageHeightCssPx;
  const requiredTrailingHeight = getRirekishoRequiredTrailingHeight(root, rootBox, summaryRow);
  if (requiredTrailingHeight === null) return;

  const minBlockHeight = headingRect.height + requiredTrailingHeight;
  const lastBottomOnPrevPage = Array.from(root.querySelectorAll<HTMLElement>('[data-export-meaningful="true"]'))
    .filter((el) => !selfPrSection.contains(el))
    .map((el) => getRelativeExportRect(rootBox, el, root))
    .filter((rect): rect is NonNullable<ReturnType<typeof getRelativeExportRect>> => Boolean(
      rect && rect.bottom <= prevPageBottom + PDF_PAGE_INTERSECTION_EPSILON_PX && rect.bottom > prevPageTop,
    ))
    .reduce((maxBottom, rect) => Math.max(maxBottom, rect.bottom), prevPageTop);

  const blankOnPrevPage = prevPageBottom - lastBottomOnPrevPage;
  if (blankOnPrevPage + PDF_PAGE_INTERSECTION_EPSILON_PX < minBlockHeight) return;

  const desiredHeadingTop = prevPageBottom - minBlockHeight;
  const reduceBy = headingRect.top - desiredHeadingTop;
  if (reduceBy <= PDF_PAGE_INTERSECTION_EPSILON_PX) return;

  heading.style.setProperty('margin-top', `${Math.max(0, headingMargin - reduceBy)}px`);
}

type CorporateFamilyLayoutId = 'corporate-navy' | 'contemporary-bold';

function applyCorporateFamilyKeepTogetherPagination(
  root: HTMLElement,
  layoutId: CorporateFamilyLayoutId,
): void {
  void root.offsetHeight;
  const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
  const rootWidth = rootRect?.width || root.offsetWidth || root.scrollWidth;
  if (rootWidth <= 0) return;

  const rootBox = { top: rootRect?.top ?? 0 };
  const pageHeightCssPx = rootWidth * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return;

  const maxShortGroupHeight = pageHeightCssPx * CORPORATE_NAVY_MAX_KEEP_GROUP_PAGE_RATIO;
  const maxExperienceUnitHeight = pageHeightCssPx * CORPORATE_NAVY_EXPERIENCE_MAX_KEEP_UNIT_PAGE_RATIO;
  const sectionGroupSelector = `[data-export-group="${layoutId}-section"]`;
  const experienceGroupSelector = `[data-export-group="${layoutId}-experience"]`;
  const bodySelector = `[data-${layoutId}-pdf-body]`;

  const shiftHeaderIfNeeded = (header: HTMLElement, requiredTrailingHeight: number | null): boolean => {
    const rect = getRelativeExportRect(rootBox, header, root);
    if (!rect || rect.height <= 0) return false;

    const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const headerItselfStraddles = startsOnPage !== endsOnPage;

    const pageBottom = (startsOnPage + 1) * pageHeightCssPx;
    const roomAfterHeader = pageBottom - rect.bottom;
    const wouldOrphanHeading = requiredTrailingHeight !== null
      && requiredTrailingHeight > 0
      && roomAfterHeader + PDF_PAGE_INTERSECTION_EPSILON_PX < requiredTrailingHeight;

    if (!headerItselfStraddles && !wouldOrphanHeading) return false;

    const shiftPx = Math.max(0, pageBottom - rect.top + CORPORATE_NAVY_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    shiftGroupToNextPage(header, shiftPx);
    return true;
  };

  const shiftIfStraddling = (el: HTMLElement, maxHeight: number): boolean => {
    const rect = getRelativeExportRect(rootBox, el, root);
    if (!rect || rect.height <= 0 || rect.height >= maxHeight) return false;

    const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    if (startsOnPage === endsOnPage) return false;

    const nextPageTop = (startsOnPage + 1) * pageHeightCssPx;
    const shiftPx = Math.max(0, nextPageTop - rect.top + CORPORATE_NAVY_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    shiftGroupToNextPage(el, shiftPx);
    return true;
  };

  const getRequiredTrailingHeightForSection = (firstContent: HTMLElement): number | null => {
    const firstContentRect = getRelativeExportRect(rootBox, firstContent, root);
    if (!firstContentRect) return null;

    if (firstContent.matches(experienceGroupSelector)) {
      const titleRow = firstContent.querySelector<HTMLElement>(':scope > div');
      const company = firstContent.querySelector<HTMLElement>(':scope > p');
      const firstBullet = Array.from(firstContent.children).find(
        (child): child is HTMLElement => child instanceof HTMLElement
          && child.tagName === 'DIV'
          && child.getAttribute('data-export-meaningful') === 'true',
      ) ?? null;
      const titleRect = titleRow ? getRelativeExportRect(rootBox, titleRow, root) : null;
      const companyRect = company ? getRelativeExportRect(rootBox, company, root) : null;
      const bulletRect = firstBullet ? getRelativeExportRect(rootBox, firstBullet, root) : null;
      if (titleRect) {
        const anchorTop = titleRect.top;
        const anchorBottom = bulletRect?.bottom ?? companyRect?.bottom ?? firstContentRect.bottom;
        if (anchorBottom > anchorTop) return anchorBottom - anchorTop;
      }
      return firstContentRect.height;
    }

    const firstMeaningful = firstContent.querySelector<HTMLElement>('[data-export-meaningful="true"]');
    if (firstMeaningful && firstMeaningful !== firstContent) {
      const containerRect = getRelativeExportRect(rootBox, firstContent, root);
      const meaningfulRect = getRelativeExportRect(rootBox, firstMeaningful, root);
      if (containerRect && meaningfulRect && meaningfulRect.bottom > containerRect.top) {
        return meaningfulRect.bottom - containerRect.top;
      }
    }

    return firstContentRect.height;
  };

  for (let pass = 0; pass < 8; pass += 1) {
    let movedAnyGroup = false;

    const sections = Array.from(root.querySelectorAll<HTMLElement>(sectionGroupSelector));
    for (const section of sections) {
      const heading = section.querySelector<HTMLElement>(':scope > h2');
      if (!heading || section.firstElementChild !== heading) continue;

      const firstContent = heading.nextElementSibling;
      if (!(firstContent instanceof HTMLElement)) continue;

      const requiredTrailingHeight = getRequiredTrailingHeightForSection(firstContent);
      if (shiftHeaderIfNeeded(heading, requiredTrailingHeight)) movedAnyGroup = true;
    }

    const experienceEntries = Array.from(root.querySelectorAll<HTMLElement>(experienceGroupSelector));
    for (const entry of experienceEntries) {
      const bullets = Array.from(entry.children).filter(
        (child): child is HTMLElement => child instanceof HTMLElement
          && child.tagName === 'DIV'
          && child.getAttribute('data-export-meaningful') === 'true',
      );
      for (const bullet of bullets) {
        if (shiftIfStraddling(bullet, maxExperienceUnitHeight)) movedAnyGroup = true;
      }
    }

    const educationRows = Array.from(
      root.querySelectorAll<HTMLElement>(
        `${bodySelector} ${sectionGroupSelector} > div:not(${experienceGroupSelector})`,
      ),
    );
    for (const row of educationRows) {
      if (row.querySelector(':scope > h3')) {
        if (shiftIfStraddling(row, maxShortGroupHeight)) movedAnyGroup = true;
      }
    }

    if (!movedAnyGroup) break;
  }
}

export function applyCorporateNavyKeepTogetherPagination(root: HTMLElement): void {
  applyCorporateFamilyKeepTogetherPagination(root, 'corporate-navy');
}

export function applyContemporaryBoldKeepTogetherPagination(root: HTMLElement): void {
  applyCorporateFamilyKeepTogetherPagination(root, 'contemporary-bold');
}

// Modern Minimal previously used only generic fixed-height html2canvas slicing with no
// pre-capture keep-together pass. That let WORK EXPERIENCE land at the bottom of a page
// with only the first job title/date visible while the company line and bullets started on
// the next page — exactly the orphan-heading pattern Corporate Navy/Contemporary Bold
// already guard against.
export function applyModernMinimalKeepTogetherPagination(root: HTMLElement): void {
  void root.offsetHeight;
  const rootRect = getPositiveRect(root.getBoundingClientRect(), root);
  const rootWidth = rootRect?.width || root.offsetWidth || root.scrollWidth;
  if (rootWidth <= 0) return;

  const rootBox = { top: rootRect?.top ?? 0 };
  const pageHeightCssPx = rootWidth * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return;

  const maxShortGroupHeight = pageHeightCssPx * MODERN_MINIMAL_MAX_KEEP_GROUP_PAGE_RATIO;
  const maxExperienceUnitHeight = pageHeightCssPx * MODERN_MINIMAL_EXPERIENCE_MAX_KEEP_UNIT_PAGE_RATIO;

  const shiftHeaderIfNeeded = (header: HTMLElement, requiredTrailingHeight: number | null): boolean => {
    const rect = getRelativeExportRect(rootBox, header, root);
    if (!rect || rect.height <= 0) return false;

    const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const headerItselfStraddles = startsOnPage !== endsOnPage;

    const pageBottom = (startsOnPage + 1) * pageHeightCssPx;
    const roomAfterHeader = pageBottom - rect.bottom;
    const wouldOrphanHeading = requiredTrailingHeight !== null
      && requiredTrailingHeight > 0
      && roomAfterHeader + PDF_PAGE_INTERSECTION_EPSILON_PX < requiredTrailingHeight;

    if (!headerItselfStraddles && !wouldOrphanHeading) return false;

    const shiftPx = Math.max(0, pageBottom - rect.top + MODERN_MINIMAL_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    shiftGroupToNextPage(header, shiftPx);
    return true;
  };

  const shiftIfStraddling = (el: HTMLElement, maxHeight: number): boolean => {
    const rect = getRelativeExportRect(rootBox, el, root);
    if (!rect || rect.height <= 0 || rect.height >= maxHeight) return false;

    const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    if (startsOnPage === endsOnPage) return false;

    const nextPageTop = (startsOnPage + 1) * pageHeightCssPx;
    const shiftPx = Math.max(0, nextPageTop - rect.top + MODERN_MINIMAL_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    shiftGroupToNextPage(el, shiftPx);
    return true;
  };

  const getRequiredTrailingHeightForExperienceEntry = (entry: HTMLElement): number | null => {
    const header = entry.querySelector<HTMLElement>('[data-export-group="modern-minimal-experience-header"]');
    const firstLine = entry.querySelector<HTMLElement>('[data-export-group="modern-minimal-experience-line"]');
    const headerRect = header ? getRelativeExportRect(rootBox, header, root) : null;
    const lineRect = firstLine ? getRelativeExportRect(rootBox, firstLine, root) : null;
    if (headerRect && lineRect && lineRect.bottom > headerRect.top) {
      return lineRect.bottom - headerRect.top;
    }
    if (headerRect) return headerRect.height;
    const entryRect = getRelativeExportRect(rootBox, entry, root);
    return entryRect?.height ?? null;
  };

  for (let pass = 0; pass < 8; pass += 1) {
    let movedAnyGroup = false;
    const entries = Array.from(root.querySelectorAll<HTMLElement>('[data-export-group="modern-minimal-experience"]'));
    const firstEntry = entries[0] ?? null;

    if (firstEntry) {
      const sectionEl = firstEntry.parentElement;
      const heading = sectionEl?.querySelector<HTMLElement>(':scope > h2') ?? null;
      if (heading && sectionEl?.firstElementChild === heading) {
        const requiredTrailingHeight = getRequiredTrailingHeightForExperienceEntry(firstEntry);
        if (shiftHeaderIfNeeded(heading, requiredTrailingHeight)) movedAnyGroup = true;
      }
    }

    for (const entry of entries) {
      const header = entry.querySelector<HTMLElement>('[data-export-group="modern-minimal-experience-header"]');
      const lines = Array.from(entry.querySelectorAll<HTMLElement>('[data-export-group="modern-minimal-experience-line"]'));
      if (header) {
        const firstLineRect = lines.length > 0 ? getRelativeExportRect(rootBox, lines[0], root) : null;
        if (shiftHeaderIfNeeded(header, firstLineRect ? firstLineRect.height : null)) movedAnyGroup = true;
      }
      for (const line of lines) {
        if (shiftIfStraddling(line, maxExperienceUnitHeight)) movedAnyGroup = true;
      }
    }

    const shortGroups = Array.from(root.querySelectorAll<HTMLElement>(
      '[data-export-group="modern-minimal-education"],[data-export-group="modern-minimal-skills-languages"]',
    ));
    for (const group of shortGroups) {
      if (shiftIfStraddling(group, maxShortGroupHeight)) movedAnyGroup = true;
    }

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-export-group="modern-minimal-section"]'));
    for (const section of sections) {
      const heading = section.querySelector<HTMLElement>(':scope > h2');
      if (!heading || section.firstElementChild !== heading) continue;
      const firstContent = heading.nextElementSibling;
      if (!(firstContent instanceof HTMLElement)) continue;
      if (firstContent.matches('[data-export-group="modern-minimal-experience"]')) continue;

      const firstMeaningful = firstContent.querySelector<HTMLElement>('[data-export-meaningful="true"]');
      const containerRect = getRelativeExportRect(rootBox, firstContent, root);
      const meaningfulRect = firstMeaningful ? getRelativeExportRect(rootBox, firstMeaningful, root) : null;
      const requiredTrailingHeight = containerRect && meaningfulRect && meaningfulRect.bottom > containerRect.top
        ? meaningfulRect.bottom - containerRect.top
        : containerRect?.height ?? null;
      if (shiftHeaderIfNeeded(heading, requiredTrailingHeight)) movedAnyGroup = true;
    }

    if (!movedAnyGroup) break;
  }
}

export function applyProfessionalClassicKeepTogetherPagination(root: HTMLElement): void {
  const rootBox = getPositiveRect(root.getBoundingClientRect(), root);
  if (!rootBox || rootBox.width <= 0) return;

  const pageHeightCssPx = rootBox.width * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return;

  const groupSelectors = [
    '[data-export-group="professional-classic-experience"]',
    '[data-export-group="professional-classic-education-section"]',
    '[data-export-group="professional-classic-skills-languages"]',
    '[data-export-group="professional-classic-certifications"]',
  ].join(',');

  const maxShortGroupHeight = pageHeightCssPx * PROFESSIONAL_CLASSIC_MAX_KEEP_GROUP_PAGE_RATIO;

  for (let pass = 0; pass < 4; pass += 1) {
    let movedAnyGroup = false;
    const groups = Array.from(root.querySelectorAll<HTMLElement>(groupSelectors));
    for (const group of groups) {
      const rect = getRelativeExportRect(rootBox, group);
      if (!rect || rect.height <= 0 || rect.height >= maxShortGroupHeight) continue;

      const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
      const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
      if (startsOnPage === endsOnPage) continue;

      const nextPageTop = (startsOnPage + 1) * pageHeightCssPx;
      const shiftPx = Math.max(0, nextPageTop - rect.top + PROFESSIONAL_CLASSIC_GROUP_PAGE_PADDING_PX);
      if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) continue;

      shiftGroupToNextPage(group, shiftPx);
      movedAnyGroup = true;
    }
    if (!movedAnyGroup) break;
  }
}

// Creative Bold's two-column (red sidebar + white main) layout previously had no
// keep-together pagination at all for its `main`-column Work Experience/Education/
// Certifications content, unlike every other multipage template. The first fix treated
// every Work Experience entry as one indivisible block (like Education/Certifications),
// which stopped headings/lines being sliced mid-glyph, but for a long entry that starts
// near a page boundary it also relocated the ENTIRE entry (heading + every description
// line) to the next page — leaving most of the previous page blank underneath the prior
// entry, purely because that entry's *later* lines happened to cross the boundary.
//
// This revision keeps Education/Certifications as whole indivisible blocks (they're
// always short), but makes Work Experience entries split-friendly after a safe minimum:
//  - the header (title + company/date, `creative-bold-experience-header`) is only ever
//    pushed to the next page if it would itself be sliced by the boundary, OR if there
//    is not enough room left on the current page for at least one real description line
//    to follow it (avoiding a heading stranded alone at the very bottom of a page);
//  - each description line (`creative-bold-experience-line`, one per literal `\n` in the
//    source text) is its own atomic "never slice this" unit — if a later line would
//    itself be cut mid-glyph by a page boundary, only that one line (and whatever
//    follows it) is nudged onto the next page, never the whole entry.
// Net effect: a long entry can start on the current page with its heading plus at least
// one content line, and its remaining lines flow naturally onto later pages exactly
// where they land, instead of the whole entry jumping wholesale and stranding a big
// blank gap. Only `main`-column content is targeted; the red sidebar column keeps
// flowing independently from the top, unaffected by these shifts.
export function applyCreativeBoldKeepTogetherPagination(root: HTMLElement): void {
  const rootBox = getPositiveRect(root.getBoundingClientRect(), root);
  if (!rootBox || rootBox.width <= 0) return;

  const pageHeightCssPx = rootBox.width * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return;

  const maxShortGroupHeight = pageHeightCssPx * CREATIVE_BOLD_MAX_KEEP_GROUP_PAGE_RATIO;

  const shiftIfStraddling = (el: HTMLElement): boolean => {
    const rect = getRelativeExportRect(rootBox, el);
    if (!rect || rect.height <= 0 || rect.height >= maxShortGroupHeight) return false;

    const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    if (startsOnPage === endsOnPage) return false;

    const nextPageTop = (startsOnPage + 1) * pageHeightCssPx;
    const shiftPx = Math.max(0, nextPageTop - rect.top + CREATIVE_BOLD_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    shiftGroupToNextPage(el, shiftPx);
    return true;
  };

  const pageIndexOf = (y: number): number => Math.floor((y + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);

  const shiftBlockIfNeeded = (anchor: HTMLElement, topPx: number, bottomPx: number): boolean => {
    if (bottomPx <= topPx + PDF_PAGE_INTERSECTION_EPSILON_PX) return false;
    const startsOnPage = pageIndexOf(topPx);
    const pageBottom = (startsOnPage + 1) * pageHeightCssPx;
    if (bottomPx <= pageBottom - PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    const shiftPx = Math.max(0, pageBottom - topPx + CREATIVE_BOLD_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;
    shiftGroupToNextPage(anchor, shiftPx);
    return true;
  };

  const shiftHeadingLeadGroupIfNeeded = (heading: HTMLElement, leadElements: HTMLElement[]): boolean => {
    const headingRect = getRelativeExportRect(rootBox, heading);
    const leadRects = leadElements
      .map(el => getRelativeExportRect(rootBox, el))
      .filter((rect): rect is { top: number; bottom: number; height: number } => Boolean(rect));
    if (!headingRect || leadRects.length === 0) return false;
    const bottomPx = Math.max(headingRect.bottom, ...leadRects.map(rect => rect.bottom));
    const height = bottomPx - headingRect.top;
    if (height <= 0 || height >= maxShortGroupHeight) return false;
    return shiftBlockIfNeeded(heading, headingRect.top, bottomPx);
  };

  const shiftHeaderIfNeeded = (header: HTMLElement, firstLineHeight: number | null): boolean => {
    const rect = getRelativeExportRect(rootBox, header);
    if (!rect || rect.height <= 0 || rect.height >= maxShortGroupHeight) return false;

    const startsOnPage = Math.floor((rect.top + PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const endsOnPage = Math.floor((rect.bottom - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
    const headerItselfStraddles = startsOnPage !== endsOnPage;

    const pageBottom = (startsOnPage + 1) * pageHeightCssPx;
    const roomAfterHeader = pageBottom - rect.bottom;
    const wouldOrphanHeading = firstLineHeight !== null && roomAfterHeader < firstLineHeight;

    if (!headerItselfStraddles && !wouldOrphanHeading) return false;

    const shiftPx = Math.max(0, pageBottom - rect.top + CREATIVE_BOLD_GROUP_PAGE_PADDING_PX);
    if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) return false;

    shiftGroupToNextPage(header, shiftPx);
    return true;
  };

  for (let pass = 0; pass < 8; pass += 1) {
    let movedAnyGroup = false;

    const experienceHeading = root.querySelector<HTMLElement>('[data-export-group="creative-bold-experience-section-heading"]');
    const firstExperienceEntry = root.querySelector<HTMLElement>('[data-export-group="creative-bold-experience-entry"]');
    if (experienceHeading && firstExperienceEntry) {
      const firstHeader = firstExperienceEntry.querySelector<HTMLElement>('[data-export-group="creative-bold-experience-header"]');
      const firstLines = Array.from(firstExperienceEntry.querySelectorAll<HTMLElement>('[data-export-group="creative-bold-experience-line"]')).slice(0, 2);
      const leadElements = [firstHeader, ...firstLines].filter((el): el is HTMLElement => Boolean(el));
      if (shiftHeadingLeadGroupIfNeeded(experienceHeading, leadElements)) movedAnyGroup = true;
    }

    const educationHeading = root.querySelector<HTMLElement>('[data-export-group="creative-bold-education-heading"]');
    const educationEntry = root.querySelector<HTMLElement>('[data-export-group="creative-bold-education-entry"]');
    if (educationHeading && educationEntry) {
      if (shiftHeadingLeadGroupIfNeeded(educationHeading, [educationEntry])) movedAnyGroup = true;
    }

    const entries = Array.from(root.querySelectorAll<HTMLElement>('[data-export-group="creative-bold-experience-entry"]'));
    for (const entry of entries) {
      const header = entry.querySelector<HTMLElement>('[data-export-group="creative-bold-experience-header"]');
      const lines = Array.from(entry.querySelectorAll<HTMLElement>('[data-export-group="creative-bold-experience-line"]'));

      if (header) {
        const firstLineRect = lines.length > 0 ? getRelativeExportRect(rootBox, lines[0]) : null;
        if (shiftHeaderIfNeeded(header, firstLineRect ? firstLineRect.height : null)) movedAnyGroup = true;
      }

      for (const line of lines) {
        if (shiftIfStraddling(line)) movedAnyGroup = true;
      }
    }

    const wholeGroups = Array.from(root.querySelectorAll<HTMLElement>(
      '[data-export-group="creative-bold-education-section"],[data-export-group="creative-bold-certifications"]',
    ));
    for (const group of wholeGroups) {
      if (shiftIfStraddling(group)) movedAnyGroup = true;
    }

    if (!movedAnyGroup) break;
  }
}

// Visual-polish pass for the case where, after keep-together pagination, the very last
// page ends up containing nothing but the closing Education / Skills+Languages /
// Certifications blocks with a lot of empty space below them — reads as an orphan tail
// rather than an intentional final page. This only ever *adds* modest breathing-room
// margins (never removes/shortens content, never touches page 1..N-1, never fires on a
// single-page document), so it is purely cosmetic:
//  - a small top offset so the block isn't glued to the page-cut seam;
//  - a little extra gap between Education / Skills+Languages / Certifications so the
//    closing page reads as a deliberately laid-out summary instead of cramped leftovers;
//  - a touch more gap between skill chips on that same trailing block.
export function applyProfessionalClassicFinalPageBalance(root: HTMLElement): void {
  const rootBox = getPositiveRect(root.getBoundingClientRect(), root);
  if (!rootBox || rootBox.width <= 0) return;

  const pageHeightCssPx = rootBox.width * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return;

  const totalHeight = rootBox.height;
  const pageCount = Math.ceil((totalHeight - PDF_PAGE_INTERSECTION_EPSILON_PX) / pageHeightCssPx);
  if (pageCount <= 1) return; // never touch a single-page (short-fixture) document

  const closingBlocks = [
    root.querySelector<HTMLElement>('[data-export-group="professional-classic-education-section"]'),
    root.querySelector<HTMLElement>('[data-export-group="professional-classic-skills-languages"]'),
    root.querySelector<HTMLElement>('[data-export-group="professional-classic-certifications"]'),
  ].filter((el): el is HTMLElement => Boolean(el));
  if (closingBlocks.length === 0) return;

  const lastPageIndex = pageCount - 1;
  const lastPageTop = lastPageIndex * pageHeightCssPx;

  // Whichever subset of the closing blocks (Education / Skills+Languages / Certifications)
  // actually landed on the final page — could be all three, or just the last one or two if
  // the earlier ones fit at the bottom of the previous page instead.
  const blocksOnLastPage = closingBlocks
    .map((el) => ({ el, rect: getRelativeExportRect(rootBox, el) }))
    .filter((entry): entry is { el: HTMLElement; rect: NonNullable<ReturnType<typeof getRelativeExportRect>> } =>
      Boolean(entry.rect) && entry.rect!.top >= lastPageTop - PDF_PAGE_INTERSECTION_EPSILON_PX);
  if (blocksOnLastPage.length === 0) return;

  const firstOnLastPage = blocksOnLastPage[0];
  const lastOnLastPage = blocksOnLastPage[blocksOnLastPage.length - 1];

  // Must be the very first thing on that page (nothing — e.g. a trailing Work Experience
  // entry — precedes it there); otherwise this isn't an isolated orphan tail.
  const isFirstOnPage = firstOnLastPage.rect.top - lastPageTop <= PROFESSIONAL_CLASSIC_FINAL_PAGE_MAX_LEAD_PX;
  if (!isFirstOnPage) return;

  const fillRatio = (lastOnLastPage.rect.bottom - lastPageTop) / pageHeightCssPx;
  if (fillRatio <= 0 || fillRatio >= PROFESSIONAL_CLASSIC_FINAL_PAGE_SPARSE_RATIO) return;

  const topBlock = firstOnLastPage.el;
  const currentMarginTop = parseCssPx(topBlock.style.marginTop);
  topBlock.style.setProperty('margin-top', `${currentMarginTop + PROFESSIONAL_CLASSIC_FINAL_PAGE_TOP_BREATHING_PX}px`);

  for (let i = 0; i < blocksOnLastPage.length - 1; i += 1) {
    const block = blocksOnLastPage[i].el;
    const currentMarginBottom = parseCssPx(block.style.marginBottom);
    block.style.setProperty('margin-bottom', `${currentMarginBottom + PROFESSIONAL_CLASSIC_FINAL_SECTION_GAP_EXTRA_PX}px`);
  }

  const skillsList = root.querySelector<HTMLElement>('[data-professional-classic-skills-list="true"]');
  if (skillsList) {
    const currentGap = parseCssPx(skillsList.style.gap) || 4;
    skillsList.style.setProperty('gap', `${currentGap + PROFESSIONAL_CLASSIC_FINAL_CHIP_GAP_EXTRA_PX}px`);
  }
}

function hasMeaningfulExportPayload(element: HTMLElement): boolean {
  if (element instanceof HTMLImageElement) return true;
  if (element.querySelector('img')) return true;
  return Boolean(element.textContent?.trim());
}

function getPositiveRect(rect: DOMRect, element: HTMLElement): { top: number; bottom: number; width: number; height: number } | null {
  const width = rect.width || element.offsetWidth || element.scrollWidth;
  const height = rect.height || element.offsetHeight || element.scrollHeight;
  const top = rect.top || element.offsetTop || 0;
  const bottom = rect.bottom || (top + height);
  if (width <= 0 || height <= 0 || bottom <= top) return null;
  return { top, bottom, width, height };
}

export function measureExportMeaningfulContentBounds(root: HTMLElement): MeaningfulContentBounds | null {
  const rootBox = getPositiveRect(root.getBoundingClientRect(), root);
  if (!rootBox) return null;

  const intervals: MeaningfulContentIntervalCss[] = [];
  const meaningfulElements = Array.from(root.querySelectorAll<HTMLElement>('[data-export-meaningful="true"]'));
  meaningfulElements.forEach((element) => {
    if (!hasMeaningfulExportPayload(element)) return;
    const rect = getPositiveRect(element.getBoundingClientRect(), element);
    if (!rect) return;
    const topCssPx = Math.max(0, rect.top - rootBox.top);
    const bottomCssPx = Math.max(topCssPx, rect.bottom - rootBox.top);
    if (bottomCssPx <= topCssPx) return;
    intervals.push({ topCssPx, bottomCssPx });
  });

  if (intervals.length === 0) return null;
  return {
    rootWidthCssPx: rootBox.width,
    rootHeightCssPx: rootBox.height,
    maxBottomCssPx: Math.max(...intervals.map(interval => interval.bottomCssPx)),
    intervals,
  };
}

export function createMeaningfulContentPagePlan(
  bounds: MeaningfulContentBounds,
  canvasWidthPx: number,
  fallbackCssWidthPx: number,
): MeaningfulContentPagePlan | null {
  const cssWidth = bounds.rootWidthCssPx || fallbackCssWidthPx;
  if (cssWidth <= 0 || canvasWidthPx <= 0) return null;
  const scalePxPerCssPx = canvasWidthPx / cssWidth;
  return {
    scalePxPerCssPx,
    maxBottomCanvasPx: bounds.maxBottomCssPx * scalePxPerCssPx,
    intervals: bounds.intervals.map(interval => ({
      topPx: interval.topCssPx * scalePxPerCssPx,
      bottomPx: interval.bottomCssPx * scalePxPerCssPx,
    })),
  };
}

function pageHasMeaningfulContent(plan: MeaningfulContentPagePlan, pageTopPx: number, pageBottomPx: number): boolean {
  return plan.intervals.some(interval =>
    interval.bottomPx > pageTopPx + PDF_PAGE_INTERSECTION_EPSILON_PX
    && interval.topPx < pageBottomPx - PDF_PAGE_INTERSECTION_EPSILON_PX,
  );
}

function expandRootToMeaningfulContentHeight(root: HTMLElement, bounds: MeaningfulContentBounds | null): void {
  if (!bounds) return;
  const requiredHeightCssPx = Math.ceil(Math.max(bounds.rootHeightCssPx, bounds.maxBottomCssPx + 32));
  if (requiredHeightCssPx <= 0) return;
  root.style.setProperty('height', `${requiredHeightCssPx}px`);
  root.style.setProperty('min-height', `${requiredHeightCssPx}px`);
}

function hasFutureMeaningfulContent(plan: MeaningfulContentPagePlan, pageBottomPx: number): boolean {
  return plan.maxBottomCanvasPx > pageBottomPx + PDF_PAGE_INTERSECTION_EPSILON_PX;
}

function normalizePdfTextStyles(root: HTMLElement, fontStack: string): void {
  const elements = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[];
  elements.forEach((element) => {
    element.style.setProperty('font-family', fontStack);
    element.style.setProperty('word-spacing', 'normal');
    element.style.setProperty('letter-spacing', 'normal');
    element.style.setProperty('white-space', 'normal');
    element.style.setProperty('font-kerning', 'normal');
    element.style.setProperty('text-rendering', 'geometricPrecision');
    element.style.setProperty('font-variant-ligatures', 'normal');
    element.style.setProperty('font-feature-settings', 'normal');
  });
}

function removeCloneStylesheets(clonedDocument: Document): void {
  clonedDocument
    .querySelectorAll('style, link[rel="stylesheet"]')
    .forEach(node => node.parentNode?.removeChild(node));
}

export async function prepareModernMinimalImagesForExport(target: HTMLElement): Promise<PreparedExportImage[]> {
  if (!isModernMinimalCaptureTarget(target)) return [];

  const root = getTemplateCaptureRoot(target, 'modern-minimal');
  if (!root) return [];

  const prepared: PreparedExportImage[] = [];
  const images = Array.from(root.querySelectorAll('img'));

  await Promise.all(images.map(async (img) => {
    const frame = img.parentElement as HTMLElement | null;
    if (!frame) return;

    const previousSrc = img.getAttribute('src');
    const previousAlt = img.getAttribute('alt');
    const previousFrameDisplay = frame.style.display;
    prepared.push({ img, frame, previousSrc, previousAlt, previousFrameDisplay });

    const dataUrl = previousSrc ? await resolveExportImageDataUrl(previousSrc) : null;
    const decoded = dataUrl ? await decodeImageForExport(dataUrl) : false;

    if (dataUrl && decoded) {
      img.src = dataUrl;
      img.alt = '';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.display = 'block';
      return;
    }

    img.removeAttribute('src');
    img.alt = '';
    frame.style.display = 'none';
  }));

  return prepared;
}

async function prepareTemplateImagesForExport(target: HTMLElement): Promise<PreparedExportImage[]> {
  const templateId = getExportStyleTemplateId(target);
  if (!templateId) return [];

  const root = getTemplateCaptureRoot(target, templateId);
  if (!root) return [];

  const prepared: PreparedExportImage[] = [];
  const images = Array.from(root.querySelectorAll('img'));

  await Promise.all(images.map(async (img) => {
    const frame = img.parentElement as HTMLElement | null;
    if (!frame) return;

    const previousSrc = img.getAttribute('src');
    const previousAlt = img.getAttribute('alt');
    const previousFrameDisplay = frame.style.display;
    prepared.push({ img, frame, previousSrc, previousAlt, previousFrameDisplay });

    const sourceSrc = templateId === 'professional-classic' || templateId === 'creative-bold' || templateId === 'elegant-formal'
      ? resolveProfessionalClassicImageSource(previousSrc ?? img.currentSrc ?? img.src)
      : previousSrc;
    const preparedPhoto = sourceSrc ? await prepareCvPhotoForExport(sourceSrc) : null;
    const renderedDataUrl = preparedPhoto ? null : await imageElementToDataUrl(img);
    const dataUrl = preparedPhoto?.dataUrl ?? renderedDataUrl;
    const decoded = dataUrl ? await decodeImageForExport(dataUrl) : false;

    if (dataUrl && decoded) {
      img.src = dataUrl;
      img.alt = '';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.display = 'block';
      return;
    }

    if ((templateId === 'professional-classic' || templateId === 'creative-bold' || templateId === 'elegant-formal') && previousSrc) {
      const fallbackSrc = sourceSrc ?? resolveProfessionalClassicImageSource(previousSrc);
      if (fallbackSrc && fallbackSrc !== img.src) img.src = fallbackSrc;
      img.alt = '';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.display = 'block';
      if (fallbackSrc) await decodeImageForExport(fallbackSrc);
      return;
    }

    img.removeAttribute('src');
    img.alt = '';
    frame.style.display = 'none';
  }));

  return prepared;
}

function restorePreparedExportImages(prepared: PreparedExportImage[]): void {
  for (const entry of prepared) {
    if (entry.previousSrc === null) entry.img.removeAttribute('src');
    else entry.img.setAttribute('src', entry.previousSrc);
    if (entry.previousAlt === null) entry.img.removeAttribute('alt');
    else entry.img.setAttribute('alt', entry.previousAlt);
    entry.frame.style.display = entry.previousFrameDisplay;
  }
}

// ─── DOCX Export ─────────────────────────────────────────────────────────────────────────────

export function createCorporateNavyCircularDocxPhotoDataUrl(dataUrl: string, outputSize = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sourceWidth = img.naturalWidth || img.width;
      const sourceHeight = img.naturalHeight || img.height;
      if (!sourceWidth || !sourceHeight) {
        reject(new Error('CORPORATE_NAVY_DOCX_PHOTO_DIMENSIONS_MISSING'));
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('CORPORATE_NAVY_DOCX_PHOTO_CANVAS_MISSING'));
        return;
      }

      ctx.clearRect(0, 0, outputSize, outputSize);
      const scale = Math.max(outputSize / sourceWidth, outputSize / sourceHeight);
      const scaledW = sourceWidth * scale;
      const scaledH = sourceHeight * scale;
      const dx = (outputSize - scaledW) / 2;
      const dy = (outputSize - scaledH) / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, dx, dy, scaledW, scaledH);
      ctx.restore();

      ctx.globalCompositeOperation = 'destination-in';
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = '#000000';
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('CORPORATE_NAVY_DOCX_PHOTO_LOAD_FAILED'));
    img.src = dataUrl;
  });
}

export async function exportToDOCX(
  cvData: CVData,
  fileName: string,
  locale: Locale = 'en',
  templateId?: string,
  options?: { elegantFormalPhoto?: ElegantFormalCanonicalPhotoResult | null },
): Promise<SaveFileResult> {
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
        const sy = isPortrait ? -(scaledH - outH) * 0.38 : (outH - scaledH) / 2;
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
      // Tightened from before:140/after:60 — this heading is only used by Creative
      // Bold's sidebar (skills/languages/certifications) and the extra spacing was
      // part of what pushed Education onto a near-empty page 2.
      spacing: { before: 100, after: 40 },
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
  const directElegantFormalPhoto = cfg.customLayout === 'elegant-formal' ? options?.elegantFormalPhoto ?? null : null;
  const directExecutivePremiumPhoto = cfg.customLayout === 'executive-premium'
    ? await prepareExecutivePremiumCanonicalPhoto(cvData)
    : null;
  // Clean Simple DOCX reuses the exact same photo selection + circular crop already
  // validated for the Clean Simple PDF (prefers cv.personal.photo, falls back to
  // originalPhoto, crops with the less top-biased offset that keeps chin/neck visible).
  // This is a read-only call into PDF-only code — it does not modify the PDF path.
  const directCleanSimplePhoto = cfg.customLayout === 'clean-simple'
    ? await prepareCleanSimplePdfPhotoDataUrl(cvData)
    : null;
  const rawPhotoSource = !directElegantFormalPhoto && !directExecutivePremiumPhoto && !directCleanSimplePhoto && !cfg.noPhoto && showPhoto && cvData.personal.photo ? cvData.personal.photo : null;
  const preparedRawPhoto = rawPhotoSource
    ? await prepareCvPhotoForExport(rawPhotoSource)
    : null;
  const rawPhotoDataUrl = preparedRawPhoto?.dataUrl ?? null;
  const ps = cfg.photoSize;
  let photoBytes: Uint8Array | null = null;
  let photoW = ps;
  let photoH = ps;

  // photoType tracks the DOCX ImageRun type — 'png' for circular (transparent),
  // 'jpg' for portrait rectangular crops.
  let photoType: 'png' | 'jpg' = 'png';

  if (directElegantFormalPhoto) {
    photoBytes = directElegantFormalPhoto.bytes;
    photoW = ps * (directElegantFormalPhoto.width / directElegantFormalPhoto.height);
    photoH = ps;
    photoType = 'jpg';
  } else if (directExecutivePremiumPhoto) {
    photoBytes = directExecutivePremiumPhoto.bytes;
    photoW = Math.round(ps * (directExecutivePremiumPhoto.width / directExecutivePremiumPhoto.height));
    photoH = ps;
    photoType = 'jpg';
  } else if (directCleanSimplePhoto) {
    photoBytes = dataUrlToBytes(directCleanSimplePhoto);
    photoW = ps;
    photoH = ps;
    photoType = 'png';
  } else if (rawPhotoDataUrl) {
    try {
      photoBytes = dataUrlToBytes(rawPhotoDataUrl);
      photoType = getImageMimeFromDataUrl(rawPhotoDataUrl) === 'image/jpeg' ? 'jpg' : 'png';
    } catch {
      photoBytes = null;
    }
    try {
      if (cfg.photoShape === 'portrait') {
      photoW = cfg.customLayout === 'elegant-formal'
        ? ps * (ELEGANT_FORMAL_PHOTO_EXPORT_WIDTH / ELEGANT_FORMAL_PHOTO_EXPORT_HEIGHT)
        : Math.round(ps * 0.75);
      photoH = ps;
      if (cfg.customLayout === 'elegant-formal') {
        if (await isCleanElegantFormalPortraitPhoto(rawPhotoDataUrl)) {
          photoBytes = dataUrlToBytes(rawPhotoDataUrl);
          photoType = 'jpg';
        } else {
          photoBytes = null;
        }
      } else {
        const cropped = await portraitCropDataUrl(rawPhotoDataUrl, photoW * 3, photoH * 3);
        photoBytes = dataUrlToBytes(cropped);
        photoType = 'jpg';
      }
    } else {
      // 'circle': circular PNG crop with transparent corners — works correctly in DOCX/PDF.
      // Canvas clips to a circle path before drawing, then exports as PNG (not JPEG)
      // so corners are truly transparent, not white or black.
      const cropped = cfg.customLayout === 'corporate-navy' || cfg.customLayout === 'contemporary-bold'
        ? await createCorporateNavyCircularDocxPhotoDataUrl(rawPhotoDataUrl, 512)
        : await circularCropDataUrl(rawPhotoDataUrl, 512);
      photoBytes = dataUrlToBytes(cropped);
      photoW = ps;
      photoH = ps;
      photoType = cfg.customLayout === 'corporate-navy' || cfg.customLayout === 'contemporary-bold'
        ? 'png'
        : getImageMimeFromDataUrl(cropped) === 'image/jpeg' ? 'jpg' : 'png';
    }
    } catch {
      // Keep the pre-converted original bytes if the cosmetic crop fails.
      // Corporate Navy must not embed a square fallback into its circular slot.
      if (cfg.customLayout === 'corporate-navy' || cfg.customLayout === 'contemporary-bold') photoBytes = null;
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
            new TextRun({ text: edu.degree, bold: true, size: 20, color: '111827' }),
            new TextRun({ text: '  —  ' + edu.school, size: 20, color: '6B7280' }),
          ], `${edu.startDate} – ${edu.endDate}`));
          if (edu.description) {
            target.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 22, color: '374151' })], spacing: { after: 80 } }));
          }
        } else {
          target.push(new Paragraph({
            children: [
              new TextRun({ text: edu.degree, bold: true, size: 20, color: '111827' }),
              new TextRun({ text: '  —  ' + edu.school, size: 20, color: '6B7280' }),
            ],
            spacing: { after: 12 },
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
      headerInfoCells.push(new Paragraph({ children: contacts.map((c, i) => new TextRun({ text: (i > 0 ? '  |  ' : '') + c, size: 18, color: '94A3B8' })), spacing: { after: 0 } }));
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
    children.push(new Paragraph({ text: '', spacing: { after: 110 } }));

    // ── Section heading helper (slate-800 color, gray underline border) ─────
    // Spacing tightened from the original {before:240, after:100} — long CVs with many
    // sections were the single biggest contributor to Education/Skills spilling onto an
    // otherwise near-empty trailing page. Tighter heading spacing reclaims that room on
    // every section without changing font size, color, or the underline design.
    function pcHeading(text: string) {
      return new Paragraph({
        children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 18, color: '1E293B' })],
        spacing: { before: 130, after: 70 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
      });
    }

    function pcDescriptionParagraphs(text: string) {
      return text.split('\n').flatMap((rawLine) => {
        const line = rawLine.trim();
        if (!line) return [];
        const bulletText = line.replace(/^(?:[-*]|\u2022|\d+\.)\s+/, '');
        const isBullet = bulletText !== line;
        return [new Paragraph({
          children: [
            ...(isBullet ? [new TextRun({ text: '\u2022  ', size: 22, color: '475569' })] : []),
            new TextRun({ text: bulletText, size: 22, color: '4B5563' }),
          ],
          indent: isBullet ? { left: 360, hanging: 180 } : undefined,
          spacing: { after: 40 },
        })];
      });
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    if (cvData.summary) {
      children.push(pcHeading(t.cv.summary));
      children.push(new Paragraph({ children: [new TextRun({ text: cvData.summary, size: 22, color: '374151' })], spacing: { after: 120 } }));
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
        children.push(new Paragraph({ children: [new TextRun({ text: exp.company, size: 20, color: '6B7280' })], spacing: { after: 40 } }));
        if (exp.description) {
          children.push(...pcDescriptionParagraphs(exp.description));
        }
        children.push(new Paragraph({ text: '', spacing: { after: 50 } }));
      }
    }

    // ── Education ────────────────────────────────────────────────────────────
    if (cvData.education.length > 0) {
      children.push(pcHeading(t.cv.education));
      for (const edu of cvData.education) {
        children.push(new Paragraph({ children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' })], spacing: { after: 20 } }));
        const eduMeta = [edu.school, edu.startDate && edu.endDate ? `${edu.startDate} – ${edu.endDate}` : ''].filter(Boolean).join('  |  ');
        children.push(new Paragraph({ children: [new TextRun({ text: eduMeta, size: 18, color: '6B7280' })], spacing: { after: edu.description ? 30 : 50 } }));
        if (edu.description) children.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 22, color: '374151' })], spacing: { after: 50 } }));
      }
    }

    // ── Skills + Languages: side-by-side 2-column (matching grid-cols-2) ────
    const localizedSkills = cvData.skills.map((s) => s.trim()).filter(Boolean);
    const hasSkills = localizedSkills.length > 0;
    const hasLangs = cvData.languages.length > 0;
    if (hasSkills || hasLangs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skillsColChildren: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const langsColChildren: any[] = [];

      if (hasSkills) {
        skillsColChildren.push(pcHeading(t.cv.skills));
        skillsColChildren.push(new Paragraph({ children: [new TextRun({ text: localizedSkills.join('  •  '), size: 20, color: '374151' })], spacing: { after: 50 } }));
      }
      if (hasLangs) {
        langsColChildren.push(pcHeading(t.cv.languages));
        for (const lang of cvData.languages) {
          langsColChildren.push(new Paragraph({ children: [new TextRun({ text: `${getLocalizedCvLanguageName(lang.name, locale)}`, bold: true, size: 20, color: '111827' }), new TextRun({ text: `  –  ${lang.level}`, size: 20, color: '6B7280' })], spacing: { after: 30 } }));
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
        children.push(new Paragraph({ children: [new TextRun({ text: '• ', size: 22, color: '475569' }), new TextRun({ text: cert, size: 22, color: '374151' })], spacing: { after: 30 } }));
      }
    }
  }

  // ════ LAYOUT: creative-artistic (dedicated) ══════════════════════════════════════════════════
  // Matches the HTML template exactly:
  //   • violet/fuchsia solid header (gradient not possible in DOCX → solid violet-600 #7C3AED)
  //   • circular photo 100×100 on left of header; name, title, contacts to the right
  //   • summary: violet heading (same style as every other section), plain paragraph below
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
    // Trimmed from 200 -> 140 twips: same fixed-cost tightening applied to the wide
    // page margin below, reclaiming a bit more room on every page without visibly
    // changing the header's look.
    children.push(new Paragraph({ text: '', spacing: { after: 140 } }));

    // ── Section heading helper: violet, no underline border, not uppercase ──
    // Spacing trimmed from before:240/after:100 -> before:180/after:80. This is the
    // same "compact only what's necessary" tightening already applied to
    // professional-classic/creative-bold: a long CV's trailing Education+Skills
    // previously spilled onto their own near-empty final page (Skills isolated below
    // a split Education entry) purely from small spacing/margin costs compounding
    // across many sections/entries. No section is removed or redesigned.
    function caHeading(text: string, options: { keepNext?: boolean } = {}) {
      return new Paragraph({
        children: [new TextRun({ text, bold: true, size: 22, color: '7C3AED' })],
        spacing: { before: 180, after: 80 },
        keepNext: options.keepNext ?? false,
      });
    }

    // ── Summary: violet heading (same style/helper as every other section) ──
    // Previously rendered as a bare paragraph with no title, unlike Experience/
    // Education/Skills/Languages/Certifications which all use caHeading(). Uses
    // keepNext so the heading itself can never be stranded alone at the bottom
    // of a page, separated from its own paragraph.
    if (cvData.summary) {
      children.push(caHeading(t.cv.summary, { keepNext: true }));
      children.push(new Paragraph({ children: [new TextRun({ text: cvData.summary, size: 22, color: '374151' })], spacing: { after: 200 } }));
    }

    // ── Experience: left purple border accent per entry ──────────────────────
    // Per-paragraph left borders on every title/meta/bullet line let Word page-break
    // inside an entry, leaving decorative timeline fragments. The section heading
    // plus the first entry title/meta/first bullet are wrapped in a flat cantSplit
    // table (no nested tables) so Word keeps that chain together. Remaining entries
    // stay as compact paragraphs like before — one table per entry was inflating page
    // count — with keepNext on the title/meta/bullet chain and left border only on
    // the position line (meta/bullets use indent) to limit orphan line artifacts.
    if (cvData.experience.length > 0) {
      const caVioletLeftParagraphBorder = { left: { style: BorderStyle.SINGLE, size: 14, color: 'DDD6FE' } };
      const caExperienceIndent = { left: 160 };

      function caExperienceParagraphs(
        exp: CVData['experience'][number],
        options: { isFirst?: boolean; lineSlice?: { start: number; end?: number }; trailingSpacer?: boolean },
      ) {
        const dateText = exp.isPresent ? t.cv.present : exp.endDate;
        const metaLine = [exp.company, `${exp.startDate} – ${dateText}`].filter(Boolean).join('  |  ');
        const allLines = exp.description ? exp.description.split('\n').filter((line) => line.trim()) : [];
        const lines = options.lineSlice
          ? allLines.slice(options.lineSlice.start, options.lineSlice.end)
          : allLines;
        const hasDescription = lines.length > 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const paras: any[] = [
          new Paragraph({
            children: [new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' })],
            spacing: { before: options.isFirst ? 0 : 60, after: 20 },
            border: caVioletLeftParagraphBorder,
            indent: caExperienceIndent,
            keepNext: true,
          }),
          new Paragraph({
            children: [new TextRun({ text: metaLine, size: 18, color: '8B5CF6' })],
            spacing: { after: 40 },
            indent: caExperienceIndent,
            keepNext: hasDescription,
          }),
        ];
        lines.forEach((line, lineIndex) => {
          paras.push(new Paragraph({
            children: [new TextRun({ text: line, size: 20, color: '4B5563' })],
            spacing: { after: 30 },
            indent: caExperienceIndent,
            keepNext: lineIndex === 0 && lines.length > 1,
          }));
        });
        if (options.trailingSpacer ?? true) {
          paras.push(new Paragraph({ text: '', spacing: { after: 60 } }));
        }
        return paras;
      }

      const [firstExp, ...restExp] = cvData.experience;

      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({
          cantSplit: true,
          children: [new TableCell({
            verticalAlign: VerticalAlign.TOP,
            borders: noBorders,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              caHeading(t.cv.experience, { keepNext: true }),
              ...caExperienceParagraphs(firstExp, { isFirst: true, lineSlice: { start: 0, end: 1 }, trailingSpacer: false }),
            ],
          })],
        })],
      }));

      const firstRemainderLines = firstExp.description ? firstExp.description.split('\n').filter((line) => line.trim()).slice(1) : [];
      if (firstRemainderLines.length > 0) {
        firstRemainderLines.forEach((line, lineIndex) => {
          children.push(new Paragraph({
            children: [new TextRun({ text: line, size: 20, color: '4B5563' })],
            spacing: { after: 30 },
            indent: caExperienceIndent,
            keepNext: lineIndex < firstRemainderLines.length - 1,
          }));
        });
        children.push(new Paragraph({ text: '', spacing: { after: 60 } }));
      } else {
        children.push(new Paragraph({ text: '', spacing: { after: 60 } }));
      }

      for (const exp of restExp) {
        children.push(...caExperienceParagraphs(exp, { trailingSpacer: true }));
      }
    }

    // ── Education: violet heading, degree bold, school gray ─────────────────
    if (cvData.education.length > 0) {
      children.push(caHeading(t.cv.education));
      for (const edu of cvData.education) {
        const eduDates = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
        // The school/date line previously dropped edu.startDate/edu.endDate entirely
        // (only edu.school was ever rendered), so DOCX Education silently lost the
        // dates that the PDF route already shows via the same [school, dates] meta
        // line pattern (see creative-artistic-pdf-template.ts's `dateRange`/metaLine).
        const metaLine = [edu.school, eduDates].filter(Boolean).join('  |  ');
        children.push(new Paragraph({ children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' })], spacing: { after: 20 } }));
        children.push(new Paragraph({ children: [new TextRun({ text: metaLine, size: 20, color: '6B7280' })], spacing: { after: edu.description ? 30 : 60 } }));
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
        children.push(new Paragraph({ children: [new TextRun({ text: '• ', size: 22, color: '7C3AED' }), new TextRun({ text: cert, size: 22, color: '374151' })], spacing: { after: 40 } }));
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
    const efNilBorder = { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' };
    const efNoBorders = {
      top: efNilBorder,
      bottom: efNilBorder,
      left: efNilBorder,
      right: efNilBorder,
      insideHorizontal: efNilBorder,
      insideVertical: efNilBorder,
    };
    const efNoCellBorders = {
      top: efNilBorder,
      bottom: efNilBorder,
      left: efNilBorder,
      right: efNilBorder,
      start: efNilBorder,
      end: efNilBorder,
    };
    const efTableSpacing = { value: 0 };
    // ── Header: photo left + info block centered ──────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const efInfoLines: any[] = [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', size: 48, color: '1F2937' })], spacing: { after: 30 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (cvData.personal.jobTitle || '').toUpperCase(), size: 17, color: 'B45309', bold: true })], spacing: { after: 50 } }),
    ];
    if (contacts.length > 0) {
      efInfoLines.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: contacts.flatMap((contact, index) => [
          ...(index > 0 ? [new TextRun({ text: '  |  ', size: 17, color: 'D1D5DB' })] : []),
          new TextRun({ text: contact, size: 17, color: '9CA3AF' }),
        ]),
        spacing: { after: 0 },
      }));
    }
    if (cvData.personal.fathersName) {
      efInfoLines.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 17, color: '9CA3AF' }), new TextRun({ text: cvData.personal.fathersName, size: 17, color: '9CA3AF' })], spacing: { after: 0 } }));
    }

    if (photoBytes) {
      const photoCell = new TableCell({ width: { size: 18, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: efNoCellBorders, children: [new Paragraph({ alignment: AlignmentType.LEFT, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 0 } })] });
      const infoCell = new TableCell({ width: { size: 82, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER, borders: efNoCellBorders, children: efInfoLines });
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: efNoBorders, cellSpacing: efTableSpacing, rows: [new TableRow({ cellSpacing: efTableSpacing, children: [photoCell, infoCell] })] }));
    } else {
      children.push(...efInfoLines);
    }
    // Header bottom border separator
    children.push(new Paragraph({ text: '', spacing: { before: 160, after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' } } }));

    // ── Section heading helper: amber, UPPERCASE, centered, bottom border ─
    function efHeading(text: string, withBorder = true, spacingBefore = 180) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 17, color: 'B45309' })],
        spacing: { before: spacingBefore, after: 70 },
        ...(withBorder ? { border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } } } : {}),
      });
    }

    function efDescriptionParagraphs(text: string) {
      return text.split('\n').flatMap((rawLine) => {
        const line = rawLine.trim();
        if (!line) return [];
        const bulletText = line.replace(/^(?:[-*]|\u2022|\d+\.)\s+/, '');
        return [new Paragraph({
          children: [new TextRun({ text: bulletText, size: 19, color: '4B5563' })],
          bullet: { level: 0 },
          spacing: { after: 28 },
        })];
      });
    }

    // ── Summary: centered italic, no section border on the heading ─────────
    if (cvData.summary) {
      children.push(efHeading(t.cv.summary, false));
      children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: cvData.summary, size: 21, color: '374151', italics: true })], spacing: { after: 120 } }));
    }

    // ── Experience: position/date row, company in amber below ──────────────
    if (cvData.experience.length > 0) {
      children.push(efHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} – ${exp.isPresent ? t.cv.present : exp.endDate}`;
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: efNoBorders,
          cellSpacing: efTableSpacing,
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: efNoCellBorders, children: [new Paragraph({ children: [new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' })], spacing: { after: 0 } })] }),
            new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: efNoCellBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: dateText, size: 17, color: '9CA3AF', italics: true })], spacing: { after: 0 } })] }),
          ]})],
        }));
        children.push(new Paragraph({ children: [new TextRun({ text: exp.company, size: 18, color: 'B45309' })], spacing: { after: 50 } }));
        if (exp.description) {
          children.push(...efDescriptionParagraphs(exp.description));
        }
        children.push(new Paragraph({ text: '', spacing: { after: 50 } }));
      }
    }

    // ── Education: centered degree + school | date ─────────────────────────
    if (cvData.education.length > 0) {
      children.push(efHeading(t.cv.education));
      for (const edu of cvData.education) {
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: edu.degree, bold: true, size: 21, color: '111827' })], spacing: { after: 15 } }));
        const eduMeta = [edu.school, edu.startDate && edu.endDate ? `${edu.startDate} – ${edu.endDate}` : ''].filter(Boolean).join('  |  ');
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: eduMeta, size: 18, color: '6B7280' })], spacing: { after: 60 } }));
      }
    }

    // ── Bottom 3-column grid: Skills | Languages | Certifications ──────────
    const efSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
    const efHasSkills = efSkills.length > 0;
    const efHasLangs = cvData.languages.length > 0;
    const efHasCerts = cvData.certifications.length > 0;
    if (efHasSkills || efHasLangs || efHasCerts) {
      function efColHeading(text: string): InstanceType<typeof Paragraph> {
        return new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 16, color: 'B45309' })], spacing: { before: 120, after: 60 } });
      }
      const efNoBreakItem = (text: string) => text.replace(/\s+/g, '\u00A0');
      function efSeparatedItemParagraphs(items: string[]): Array<InstanceType<typeof Paragraph>> {
        const rows: Array<InstanceType<typeof Paragraph>> = [];
        for (let index = 0; index < items.length; index += 2) {
          const rowItems = items.slice(index, index + 2);
          rows.push(new Paragraph({
            alignment: AlignmentType.CENTER,
            children: rowItems.flatMap((item, rowIndex) => [
              ...(rowIndex > 0 ? [new TextRun({ text: '  |  ', size: 18, color: 'D1D5DB' })] : []),
              new TextRun({ text: efNoBreakItem(item), size: 18, color: '4B5563' }),
            ]),
            spacing: { after: 24 },
          }));
        }
        return rows;
      }
      const skillsCol: Array<InstanceType<typeof Paragraph>> = efHasSkills
        ? [efColHeading(t.cv.skills), ...efSeparatedItemParagraphs(efSkills)]
        : [new Paragraph({ text: '' })];
      const langsCol: Array<InstanceType<typeof Paragraph>> = efHasLangs
        ? [efColHeading(t.cv.languages), ...efSeparatedItemParagraphs(cvData.languages.map((l) => `${getLocalizedCvLanguageName(l.name, locale)} (${l.level})`))]
        : [new Paragraph({ text: '' })];
      const certsCol: Array<InstanceType<typeof Paragraph>> = efHasCerts
        ? [efColHeading(t.cv.certifications), ...efSeparatedItemParagraphs(cvData.certifications)]
        : [new Paragraph({ text: '' })];

      children.push(new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } }, text: '', spacing: { before: 120, after: 0 } }));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: efNoBorders,
        cellSpacing: efTableSpacing,
        rows: [new TableRow({ children: [
          new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: efNoCellBorders, margins: { top: 0, bottom: 0, left: 0, right: 120 }, children: skillsCol }),
          new TableCell({ width: { size: 34, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: efNoCellBorders, margins: { top: 0, bottom: 0, left: 120, right: 120 }, children: langsCol }),
          new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: efNoCellBorders, margins: { top: 0, bottom: 0, left: 120, right: 0 }, children: certsCol }),
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
    const epNilHeaderBorder = { style: BorderStyle.NIL, size: 0, color: cfg.headerBg };
    const epHeaderBorders = {
      top: epNilHeaderBorder,
      bottom: epNilHeaderBorder,
      left: epNilHeaderBorder,
      right: epNilHeaderBorder,
      insideHorizontal: epNilHeaderBorder,
      insideVertical: epNilHeaderBorder,
    };
    const epContacts = [
      cvData.personal.email,
      cvData.personal.phone,
      cvData.personal.address,
    ].filter(Boolean);

    // ── Build header cell content (all centered, dark background) ───────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const epHeaderParagraphs: any[] = [];

    if (photoBytes) {
      epHeaderParagraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })],
        spacing: { after: 32 },
      }));
    }

    epHeaderParagraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: (cvData.personal.fullName || 'YOUR NAME').toUpperCase(), size: 34, color: 'FFFFFF', font: 'Georgia' })],
      spacing: { after: 16 },
    }));

    epHeaderParagraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '────────', size: 12, color: 'D97706' })],
      spacing: { after: 16 },
    }));

    epHeaderParagraphs.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: cvData.personal.jobTitle || '', size: 18, color: 'FCD34D', font: 'Georgia' })],
      spacing: { after: epContacts.length > 0 || cvData.personal.fathersName ? 28 : 0 },
    }));

    if (epContacts.length > 0) {
      epHeaderParagraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: epContacts.map((c, i) => new TextRun({ text: (i > 0 ? '  |  ' : '') + c, size: 15, color: 'D1D5DB', font: 'Georgia' })),
        spacing: { after: cvData.personal.fathersName ? 18 : 0 },
      }));
    }

    if (cvData.personal.fathersName) {
      epHeaderParagraphs.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 16, color: '9CA3AF' }), new TextRun({ text: cvData.personal.fathersName, size: 16, color: '9CA3AF' })],
        spacing: { after: 0 },
      }));
    }

    // Push full-width navy header table
    children.push(new Table({
      width: { size: 76, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      borders: epHeaderBorders,
      rows: [new TableRow({
        children: [new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: epHeaderBorders,
          shading: navyBg,
          margins: { top: photoBytes ? 130 : 150, bottom: 140, left: 220, right: 220 },
          children: epHeaderParagraphs,
        })],
      })],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 70 } }));

    // ── Section heading helper: gray, UPPERCASE, tracked, centered, bottom border ─
    function epHeading(text: string, options: { compact?: boolean; keepNext?: boolean } = {}) {
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 16, color: '9CA3AF', font: 'Georgia' })],
        spacing: { before: options.compact ? 80 : 115, after: options.compact ? 45 : 60 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } },
        keepNext: options.keepNext ?? true,
      });
    }

    // ── Summary: centered italic ───────────────────────────────────────────
    if (cvData.summary) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: cvData.summary, size: 18, color: '374151', italics: true, font: 'Georgia' })],
        spacing: { after: 80, line: 236, lineRule: 'auto' },
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
            new TableCell({ width: { size: 75, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ keepNext: true, children: [new TextRun({ text: exp.position, bold: true, size: 20, color: '111827', font: 'Georgia' })], spacing: { after: 0 } })] }),
            new TableCell({ width: { size: 25, type: WidthType.PERCENTAGE }, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: dateText, size: 16, color: '9CA3AF', italics: true })], spacing: { after: 0 } })] }),
          ]})],
        }));
        // Company in amber below
        children.push(new Paragraph({ keepNext: Boolean(exp.description), children: [new TextRun({ text: exp.company, size: 16, color: 'B45309' })], spacing: { after: 18 } }));
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            const trimmed = line.trim();
            if (trimmed) {
              const bulletText = trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
              children.push(new Paragraph({
                children: [
                  new TextRun({ text: '-  ', size: 17, color: '6B7280', font: 'Calibri' }),
                  new TextRun({ text: bulletText, size: 17, color: '374151', font: 'Calibri' }),
                ],
                indent: { left: 170, hanging: 170 },
                spacing: { after: 16, line: 224, lineRule: 'auto' },
              }));
            }
          }
        }
        children.push(new Paragraph({ text: '', spacing: { after: 24 } }));
      }
    }

    // ── Education: centered degree + school ───────────────────────────────
    if (cvData.education.length > 0) {
      children.push(epHeading(t.cv.education, { compact: true }));
      for (const edu of cvData.education) {
        const eduDates = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: edu.degree, bold: true, size: 18, color: '111827', font: 'Georgia' })], spacing: { after: 8 } }));
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: [edu.school, eduDates].filter(Boolean).join(' | '), size: 15, color: '6B7280' })], spacing: { after: edu.description ? 16 : 34 } }));
        if (edu.description) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: edu.description, size: 15, color: '4B5563' })], spacing: { after: 34 } }));
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
          children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 15, color: '9CA3AF', font: 'Georgia' })],
          spacing: { before: 80, after: 45 },
        });
      }

      if (epHasSkills) {
        epSkillsCol.push(epColHeading(t.cv.skills));
        epSkillsCol.push(new Paragraph({
          alignment: AlignmentType.LEFT,
          children: epLocalizedSkills.map((s, i) => new TextRun({ text: (i > 0 ? ' | ' : '') + s, size: 16, color: '374151' })),
          spacing: { after: 0, line: 220, lineRule: 'auto' },
        }));
      }
      if (epHasLangs) {
        epLangsCol.push(epColHeading(t.cv.languages));
        for (const lang of cvData.languages) {
          epLangsCol.push(new Paragraph({ alignment: AlignmentType.LEFT, children: [new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 16, color: '111827' }), new TextRun({ text: ` - ${lang.level}`, size: 16, color: '6B7280' })], spacing: { after: 14, line: 220, lineRule: 'auto' } }));
        }
      }

      children.push(new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E5E7EB' } }, text: '', spacing: { before: 36, after: 0 } }));
      const lowerCells = epHasLangs
        ? [
            new TableCell({ width: { size: 58, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 130 }, children: epSkillsCol.length ? epSkillsCol : [new Paragraph({ text: '' })] }),
            new TableCell({ width: { size: 42, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 130, right: 0 }, children: epLangsCol }),
          ]
        : [
            new TableCell({ width: { size: 100, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 0 }, children: epSkillsCol.length ? epSkillsCol : epLangsCol }),
          ];
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: lowerCells })],
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
  else if (cfg.customLayout === 'clean-simple') {
    const isRTL = locale === 'ar';
    const bodyAlign = isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT;
    const endCell = isRTL ? AlignmentType.LEFT : AlignmentType.RIGHT;

    function csHeading(text: string) {
      return new Paragraph({
        alignment: bodyAlign,
        bidirectional: isRTL,
        children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, color: cfg.headingColor })],
        spacing: { before: 200, after: 90 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: cfg.headingBorder } },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function csDateRow(leftRuns: any[], dateText: string) {
      const textCell = new TableCell({
        width: { size: 74, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        borders: noBorders,
        children: [new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: leftRuns, spacing: { after: 20 } })],
      });
      const dateCell = new TableCell({
        width: { size: 26, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        borders: noBorders,
        children: [new Paragraph({ alignment: endCell, children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF' })], spacing: { after: 20 } })],
      });
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: isRTL ? [dateCell, textCell] : [textCell, dateCell] })],
      });
    }

    function csDescription(text: string) {
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const isBullet = /^[-•*]|^\d+\./.test(trimmed);
        const bulletText = isBullet ? trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '') : trimmed;
        children.push(new Paragraph({
          alignment: bodyAlign,
          bidirectional: isRTL,
          children: [
            ...(isBullet ? [new TextRun({ text: '•  ', size: 20, color: cfg.accent })] : []),
            new TextRun({ text: bulletText, size: 20, color: '4B5563' }),
          ],
          indent: isBullet ? { left: 220, hanging: 220 } : undefined,
          spacing: { after: 38, line: 264, lineRule: 'auto' },
        }));
      }
    }

    // Clean Simple DOCX mirrors the live preview: compact photo/name header,
    // green hierarchy, simple rules, aligned dates, and separated skills.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headerInfo: any[] = [
      new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 44, color: '111827' })], spacing: { after: 24 } }),
    ];
    if (cvData.personal.jobTitle) {
      headerInfo.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: cvData.personal.jobTitle, size: 22, color: cfg.titleColor })], spacing: { after: 45 } }));
    }
    if (contacts.length > 0) {
      headerInfo.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: contacts.join('  |  '), size: 18, color: '6B7280' })], spacing: { after: 0 } }));
    }

    if (photoBytes) {
      const photoCell = new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        borders: noBorders,
        margins: { top: 0, bottom: 0, left: 0, right: 160 },
        children: [new Paragraph({ alignment: isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 0 } })],
      });
      const infoCell = new TableCell({
        width: { size: 85, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        borders: noBorders,
        margins: { top: 0, bottom: 0, left: 120, right: 0 },
        children: headerInfo,
      });
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: isRTL ? [infoCell, photoCell] : [photoCell, infoCell] })],
      }));
    } else {
      children.push(...headerInfo);
    }

    children.push(new Paragraph({
      // Tiny safe trim (was before:100/after:150) offsetting the slightly taller
      // circular photo box so the header block does not grow the page overall.
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: cfg.dividerColor ?? 'D1D5DB' } },
      spacing: { before: photoBytes ? 70 : 100, after: photoBytes ? 110 : 150 },
    }));

    if (cvData.summary) {
      children.push(csHeading(t.cv.summary));
      children.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: cvData.summary, size: 20, color: '374151' })], spacing: { after: 115, line: 264, lineRule: 'auto' } }));
    }

    if (cvData.experience.length > 0) {
      children.push(csHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} - ${exp.isPresent ? t.cv.present : exp.endDate}`;
        children.push(csDateRow([
          new TextRun({ text: exp.position, bold: true, size: 21, color: '111827' }),
          ...(exp.company ? [new TextRun({ text: ` at ${exp.company}`, size: 20, color: '374151' })] : []),
        ], dateText));
        if (exp.description) csDescription(exp.description);
        children.push(new Paragraph({ text: '', spacing: { after: 70 } }));
      }
    }

    if (cvData.education.length > 0) {
      children.push(csHeading(t.cv.education));
      for (const edu of cvData.education) {
        const dateText = edu.startDate || edu.endDate ? `${edu.startDate} - ${edu.endDate}` : '';
        if (dateText) {
          children.push(csDateRow([
            new TextRun({ text: edu.degree, bold: true, size: 21, color: '111827' }),
            ...(edu.school ? [new TextRun({ text: `  |  ${edu.school}`, size: 19, color: '6B7280' })] : []),
          ], dateText));
        } else {
          children.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: edu.degree, bold: true, size: 21, color: '111827' }), ...(edu.school ? [new TextRun({ text: `  |  ${edu.school}`, size: 19, color: '6B7280' })] : [])], spacing: { after: 40 } }));
        }
        if (edu.description) {
          children.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: edu.description, size: 20, color: '374151' })], spacing: { after: 70 } }));
        }
      }
    }

    if (cvData.skills.length > 0) {
      children.push(csHeading(t.cv.skills));
      const localizedSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skillRows: any[] = [];
      for (let i = 0; i < localizedSkills.length; i += 3) {
        const rowSkills = localizedSkills.slice(i, i + 3);
        while (rowSkills.length < 3) rowSkills.push('');
        skillRows.push(new TableRow({
          children: rowSkills.map((skill) => new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 35, bottom: 35, left: 60, right: 60 },
            children: [new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: skill, size: 19, color: '374151' })], spacing: { after: 0 } })],
          })),
        }));
      }
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: skillRows }));
      children.push(new Paragraph({ text: '', spacing: { after: 70 } }));
    }

    if (cvData.languages.length > 0) {
      children.push(csHeading(t.cv.languages));
      for (const lang of cvData.languages) {
        children.push(new Paragraph({
          alignment: bodyAlign,
          bidirectional: isRTL,
          children: [
            new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 20, color: '111827' }),
            new TextRun({ text: ` (${lang.level})`, size: 20, color: '6B7280' }),
          ],
          spacing: { after: 45 },
        }));
      }
    }

    if (cvData.certifications.length > 0) {
      children.push(csHeading(t.cv.certifications));
      for (const cert of cvData.certifications) {
        children.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: '•  ', size: 20, color: cfg.accent }), new TextRun({ text: cert, size: 20, color: '374151' })], spacing: { after: 45 } }));
      }
    }
  }

  else if (cfg.customLayout === 'modern-minimal') {
    const isRTL = locale === 'ar';
    const bodyAlign = isRTL ? AlignmentType.RIGHT : AlignmentType.LEFT;
    const endCell = isRTL ? AlignmentType.LEFT : AlignmentType.RIGHT;
    const chipShade = { fill: 'EEF2FF', type: ShadingType.SOLID, color: 'EEF2FF' };

    function mmHeading(text: string) {
      return new Paragraph({
        alignment: bodyAlign,
        children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, color: cfg.headingColor })],
        spacing: { before: 220, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.headingBorder } },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function mmDateRow(leftRuns: any[], dateText: string) {
      const textCell = new TableCell({
        width: { size: 73, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        borders: noBorders,
        children: [new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: leftRuns, spacing: { after: 20 } })],
      });
      const dateCell = new TableCell({
        width: { size: 27, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        borders: noBorders,
        children: [new Paragraph({ alignment: endCell, children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF' })], spacing: { after: 20 } })],
      });
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: isRTL ? [dateCell, textCell] : [textCell, dateCell] })],
      });
    }

    function mmDescription(text: string) {
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const isBullet = /^[-•*]|^\d+\./.test(trimmed);
        const bulletText = isBullet ? trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '') : trimmed;
        children.push(new Paragraph({
          alignment: bodyAlign,
          bidirectional: isRTL,
          children: [
            ...(isBullet ? [new TextRun({ text: '•  ', size: 20, color: cfg.accent })] : []),
            new TextRun({ text: bulletText, size: 20, color: '374151' }),
          ],
          indent: isBullet ? { left: 220, hanging: 220 } : undefined,
          spacing: { after: 42, line: 276, lineRule: 'auto' },
        }));
      }
    }

    // Modern Minimal DOCX mirrors the app preview: compact header, circular photo
    // at the visual end, indigo rules, right-aligned dates, and wrapped skill chips.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headerInfo: any[] = [
      new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 48, color: '111827' })], spacing: { after: 36 } }),
    ];
    if (cvData.personal.jobTitle) {
      headerInfo.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: cvData.personal.jobTitle, size: 24, color: cfg.titleColor })], spacing: { after: 60 } }));
    }
    if (contacts.length > 0) {
      headerInfo.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: contacts.join('  |  '), size: 18, color: '6B7280' })], spacing: { after: 0 } }));
    }
    if (cvData.personal.fathersName) {
      headerInfo.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 18, color: '6B7280' }), new TextRun({ text: cvData.personal.fathersName, size: 18, color: '6B7280' })], spacing: { after: 0 } }));
    }

    if (photoBytes) {
      const infoCell = new TableCell({ width: { size: 80, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, children: headerInfo });
      const photoCell = new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.TOP,
        borders: noBorders,
        children: [new Paragraph({ alignment: endCell, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 0 } })],
      });
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: isRTL ? [photoCell, infoCell] : [infoCell, photoCell] })],
      }));
    } else {
      children.push(...headerInfo);
    }

    children.push(new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: cfg.headingBorder } },
      spacing: { before: 120, after: 160 },
    }));

    if (cvData.summary) {
      children.push(mmHeading(t.cv.summary));
      children.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: cvData.summary, size: 20, color: '374151' })], spacing: { after: 120, line: 276, lineRule: 'auto' } }));
    }

    if (cvData.experience.length > 0) {
      children.push(mmHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} - ${exp.isPresent ? t.cv.present : exp.endDate}`;
        children.push(mmDateRow([
          new TextRun({ text: exp.position, bold: true, size: 20, color: '111827' }),
          ...(exp.company ? [new TextRun({ text: `  |  ${exp.company}`, size: 20, color: '6B7280' })] : []),
        ], dateText));
        if (exp.description) mmDescription(exp.description);
        children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
      }
    }

    if (cvData.education.length > 0) {
      children.push(mmHeading(t.cv.education));
      for (const edu of cvData.education) {
        const dateText = edu.startDate || edu.endDate ? `${edu.startDate} - ${edu.endDate}` : '';
        if (dateText) {
          children.push(mmDateRow([
            new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' }),
            ...(edu.school ? [new TextRun({ text: `  |  ${edu.school}`, size: 20, color: '6B7280' })] : []),
          ], dateText));
        } else {
          children.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' }), ...(edu.school ? [new TextRun({ text: `  |  ${edu.school}`, size: 20, color: '6B7280' })] : [])], spacing: { after: 40 } }));
        }
        if (edu.description) {
          children.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: edu.description, size: 20, color: '374151' })], spacing: { after: 80 } }));
        }
      }
    }

    if (cvData.skills.length > 0) {
      children.push(mmHeading(t.cv.skills));
      const localizedSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = [];
      for (let i = 0; i < localizedSkills.length; i += 3) {
        const slice = localizedSkills.slice(i, i + 3);
        while (slice.length < 3) slice.push('');
        rows.push(new TableRow({
          children: slice.map((skill) => new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            borders: noBorders,
            shading: skill ? chipShade : undefined,
            margins: { top: 55, bottom: 55, left: 90, right: 90 },
            children: [new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: skill, size: 18, color: '4338CA' })], spacing: { after: 0 } })],
          })),
        }));
      }
      children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows }));
      children.push(new Paragraph({ text: '', spacing: { after: 80 } }));
    }

    if (cvData.languages.length > 0) {
      children.push(mmHeading(t.cv.languages));
      for (const lang of cvData.languages) {
        children.push(new Paragraph({
          alignment: bodyAlign,
          bidirectional: isRTL,
          children: [
            new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 20, color: '111827' }),
            new TextRun({ text: ` - ${lang.level}`, size: 20, color: '6B7280' }),
          ],
          spacing: { after: 50 },
        }));
      }
    }

    if (cvData.certifications.length > 0) {
      children.push(mmHeading(t.cv.certifications));
      for (const cert of cvData.certifications) {
        children.push(new Paragraph({ alignment: bodyAlign, bidirectional: isRTL, children: [new TextRun({ text: '•  ', size: 20, color: cfg.accent }), new TextRun({ text: cert, size: 20, color: '374151' })], spacing: { after: 50 } }));
      }
    }
  }

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

    function cnSpaced(text: string): string {
      return text.toUpperCase().split('').join(' ');
    }

    function cnHeading(text: string) {
      return new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: cnSpaced(text), bold: true, size: 17, color: cfg.headingColor })],
        spacing: { before: 150, after: 72 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.headingBorder } },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function cnDateRow(leftRuns: any[], dateText: string) {
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        rows: [new TableRow({ children: [
          new TableCell({
            width: { size: 73, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 0, bottom: 0, left: 0, right: 80 },
            children: [new Paragraph({ children: leftRuns, spacing: { after: 8 } })],
          }),
          new TableCell({
            width: { size: 27, type: WidthType.PERCENTAGE },
            borders: noBorders,
            margins: { top: 0, bottom: 0, left: 80, right: 0 },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: dateText, size: 16, color: '9CA3AF', italics: true })],
              spacing: { after: 8 },
            })],
          }),
        ]})],
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cnHeaderTextChildren: any[] = [
      new Paragraph({
        children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 38, color: 'FFFFFF' })],
        spacing: { after: 24 },
      }),
    ];
    if (cvData.personal.jobTitle) {
      cnHeaderTextChildren.push(new Paragraph({
        children: [new TextRun({ text: cvData.personal.jobTitle, size: 20, color: '93C5FD' })],
        spacing: { after: 42 },
      }));
    }
    const cnContacts: string[] = [];
    if (cvData.personal.email) cnContacts.push(cvData.personal.email);
    if (cvData.personal.phone) cnContacts.push(cvData.personal.phone);
    if (rs.showAddress && cvData.personal.address) cnContacts.push(cvData.personal.address);
    if (cvData.personal.dateOfBirth) cnContacts.push(cvData.personal.dateOfBirth!);
    if (cvData.personal.nationality) cnContacts.push(cvData.personal.nationality!);
    if (cnContacts.length > 0) {
      cnHeaderTextChildren.push(new Paragraph({
        children: [new TextRun({ text: cnContacts.join('  |  '), size: 16, color: 'CBD5E1' })],
        spacing: { after: 0 },
      }));
    }
    if (cvData.personal.fathersName) {
      cnHeaderTextChildren.push(new Paragraph({
        children: [
          new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 16, color: 'CBD5E1' }),
          new TextRun({ text: cvData.personal.fathersName, size: 16, color: 'CBD5E1' }),
        ],
        spacing: { after: 0 },
      }));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cnHeaderCells: any[] = [
      new TableCell({
        width: { size: photoBytes ? 80 : 100, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        borders: noBorders,
        shading: cnBg,
        margins: { top: 190, bottom: 170, left: 340, right: 160 },
        children: cnHeaderTextChildren,
      }),
    ];
    if (photoBytes) {
      cnHeaderCells.push(new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        borders: noBorders,
        shading: cnBg,
        margins: { top: 160, bottom: 150, left: 100, right: 320 },
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new ImageRun({ data: photoBytes, transformation: { width: 76, height: 76 }, type: photoType })],
          spacing: { after: 0 },
        })],
      }));
    }

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [new TableRow({ children: cnHeaderCells })],
    }));

    const cnAccentBg = { fill: cfg.accent, type: ShadingType.SOLID, color: cfg.accent };
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: noBorders,
      rows: [new TableRow({ children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorders,
        shading: cnAccentBg,
        margins: { top: 4, bottom: 4, left: 0, right: 0 },
        children: [new Paragraph({ text: '', spacing: { after: 0 } })],
      })] })],
    }));
    children.push(new Paragraph({ text: '', spacing: { after: 80 } }));

    if (cvData.summary) {
      children.push(cnHeading(t.cv.summary));
      children.push(new Paragraph({
        children: [new TextRun({ text: cvData.summary, size: 19, color: '374151' })],
        spacing: { after: 70, line: 230, lineRule: 'auto' },
      }));
    }

    if (cvData.experience.length > 0) {
      children.push(cnHeading(t.cv.experience));
      for (const exp of cvData.experience) {
        const dateText = `${exp.startDate} - ${exp.isPresent ? t.cv.present : exp.endDate}`;
        children.push(cnDateRow([
          new TextRun({ text: exp.position, bold: true, size: 20, color: '111827' }),
        ], dateText));
        children.push(new Paragraph({
          children: [new TextRun({ text: exp.company, size: 17, color: cfg.accent })],
          spacing: { after: 24 },
        }));
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const isBullet = /^[-•*]|^\d+\./.test(trimmed);
            const bulletText = isBullet ? trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '') : trimmed;
            children.push(new Paragraph({
              children: [
                new TextRun({ text: isBullet ? '-  ' : '', size: 17, color: cfg.accent }),
                new TextRun({ text: bulletText, size: 17, color: '374151' }),
              ],
              indent: isBullet ? { left: 160, hanging: 160 } : undefined,
              spacing: { after: 12, line: 218, lineRule: 'auto' },
            }));
          }
        }
        children.push(new Paragraph({ text: '', spacing: { after: 28 } }));
      }
    }

    if (cvData.education.length > 0) {
      children.push(cnHeading(t.cv.education));
      for (const edu of cvData.education) {
        const dateText = edu.startDate || edu.endDate ? `${edu.startDate} - ${edu.endDate}` : '';
        if (dateText) {
          children.push(cnDateRow([
            new TextRun({ text: edu.degree, bold: true, size: 20, color: '111827' }),
          ], dateText));
        } else {
          children.push(new Paragraph({
            children: [new TextRun({ text: edu.degree, bold: true, size: 20, color: '111827' })],
            spacing: { after: 8 },
          }));
        }
        children.push(new Paragraph({
          children: [new TextRun({ text: edu.school, size: 17, color: '6B7280' })],
          spacing: { after: edu.description ? 18 : 34 },
        }));
        if (edu.description) {
          children.push(new Paragraph({
            children: [new TextRun({ text: edu.description, size: 17, color: '374151' })],
            spacing: { after: 34, line: 218, lineRule: 'auto' },
          }));
        }
      }
    }

    const hasSkills = cvData.skills.length > 0;
    const hasLanguages = cvData.languages.length > 0;
    const hasCerts = cvData.certifications.length > 0;
    if (hasSkills || hasLanguages || hasCerts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const skillsChildren: any[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const metaChildren: any[] = [];

      if (hasSkills) {
        skillsChildren.push(cnHeading(t.cv.skills));
        const cnSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
        skillsChildren.push(new Paragraph({
          children: [new TextRun({ text: cnSkills.join('  |  '), size: 17, color: '374151' })],
          spacing: { after: 12, line: 218, lineRule: 'auto' },
        }));
      }
      if (hasLanguages) {
        metaChildren.push(cnHeading(t.cv.languages));
        for (const lang of cvData.languages) {
          metaChildren.push(new Paragraph({
            children: [
              new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 17, color: '111827' }),
              new TextRun({ text: ' / ' + lang.level, size: 17, color: '6B7280' }),
            ],
            spacing: { after: 14 },
          }));
        }
      }
      if (hasCerts) {
        metaChildren.push(cnHeading(t.cv.certifications));
        for (const cert of cvData.certifications) {
          metaChildren.push(new Paragraph({
            children: [new TextRun({ text: cert, size: 17, color: '374151' })],
            spacing: { after: 14 },
          }));
        }
      }

      if (hasSkills && (hasLanguages || hasCerts)) {
        if (skillsChildren.length === 0) skillsChildren.push(new Paragraph({ text: '' }));
        if (metaChildren.length === 0) metaChildren.push(new Paragraph({ text: '' }));
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorders,
          rows: [new TableRow({ children: [
            new TableCell({ width: { size: 62, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 0, right: 160 }, children: skillsChildren }),
            new TableCell({ width: { size: 38, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 0, bottom: 0, left: 160, right: 0 }, children: metaChildren }),
          ]})],
        }));
      } else {
        children.push(...skillsChildren, ...metaChildren);
      }
    }
  }

  else if (false && cfg.customLayout === 'corporate-navy') {
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
      cnHeaderChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: photoBytes!, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 100 } }));
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
    if (cvData.personal.dateOfBirth) cnContacts.push(cvData.personal.dateOfBirth!);
    if (cvData.personal.nationality) cnContacts.push(cvData.personal.nationality!);
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
          new TextRun({ text: exp.position, bold: true, size: 20, color: '111827' }),
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
            new TextRun({ text: edu.degree, bold: true, size: 20, color: '111827' }),
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
        spacing: { before: 0, after: 100 },
      }));
    }

    // Name
    sidebarChildren.push(new Paragraph({
      children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 26, color: 'FFFFFF' })],
      spacing: { after: 36 },
    }));

    // Job title
    if (cvData.personal.jobTitle) {
      sidebarChildren.push(new Paragraph({
        children: [new TextRun({ text: cvData.personal.jobTitle, size: 18, color: cfg.accent })],
        spacing: { after: 80 },
      }));
    }

    // Contacts — each on its own line, white
    for (const c of contacts) {
      sidebarChildren.push(new Paragraph({
        children: [new TextRun({ text: c, size: 16, color: 'CBD5E1' })],
        spacing: { after: 30 },
      }));
    }
    if (cvData.personal.fathersName) {
      sidebarChildren.push(new Paragraph({
        children: [
          new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 16, color: 'CBD5E1' }),
          new TextRun({ text: cvData.personal.fathersName, size: 16, color: 'CBD5E1' }),
        ],
        spacing: { after: 30 },
      }));
    }

    // Skills in sidebar
    if (cvData.skills.length > 0) {
      sidebarChildren.push(new Paragraph({
        children: [new TextRun({ text: t.cv.skills.toUpperCase(), bold: true, size: 15, color: cfg.accent })],
        spacing: { before: 110, after: 50 },
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
        children: [new TextRun({ text: t.cv.languages.toUpperCase(), bold: true, size: 15, color: cfg.accent })],
        spacing: { before: 110, after: 50 },
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
        children: [new TextRun({ text: t.cv.certifications.toUpperCase(), bold: true, size: 15, color: cfg.accent })],
        spacing: { before: 110, after: 50 },
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
        children: [new TextRun({ text: label, bold: true, size: 16, color: cfg.headingColor })],
        spacing: { before: 120, after: 55 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: cfg.headingBorder } },
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
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [new Paragraph({ children: leftRuns.slice(0, 1), spacing: { after: 8 } })],
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: dateText, size: 16, color: '94A3B8', italics: true })],
              spacing: { after: 8 },
            })],
          }),
        ]})],
      });
    }

    // PROFESSIONAL SUMMARY
    if (cvData.summary) {
      mainChildren.push(techMainHeading(t.cv.summary));
      mainChildren.push(new Paragraph({
        children: [new TextRun({ text: cvData.summary, size: 18, color: '374151' })],
        spacing: { after: 70, line: 230, lineRule: 'auto' },
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
        if (exp.company) {
          mainChildren.push(new Paragraph({
            children: [new TextRun({ text: exp.company, size: 17, color: cfg.headingColor })],
            spacing: { after: exp.description ? 20 : 40 },
          }));
        }
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            const trimmed = line.trim();
            if (trimmed) {
              const bulletText = trimmed.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '');
              mainChildren.push(new Paragraph({
                children: [
                  new TextRun({ text: '-  ', size: 17, color: '6B7280' }),
                  new TextRun({ text: bulletText, size: 17, color: '374151' }),
                ],
                indent: { left: 170, hanging: 170 },
                spacing: { after: 14, line: 220, lineRule: 'auto' },
              }));
            }
          }
        }
        mainChildren.push(new Paragraph({ text: '', spacing: { after: 32 } }));
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
              new TextRun({ text: edu.degree, bold: true, size: 20, color: '111827' }),
              new TextRun({ text: '  —  ' + edu.school, size: 20, color: '6B7280' }),
            ],
            spacing: { after: 12 },
          }));
        }
        if (edu.school) {
          mainChildren.push(new Paragraph({
            children: [new TextRun({ text: edu.school, size: 16, color: '6B7280' })],
            spacing: { after: edu.description ? 18 : 34 },
          }));
        }
        if (edu.description) {
          mainChildren.push(new Paragraph({
            children: [new TextRun({ text: edu.description, size: 17, color: '374151' })],
            spacing: { after: 34, line: 220, lineRule: 'auto' },
          }));
        }
      }
    }

    // ── SKILLS + LANGUAGES: nested 2-column table at the bottom of main panel ──
    const hasSkillsOrLangs = false;
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
          margins: { top: 210, bottom: 0, left: 200, right: 180 },
          children: sidebarChildren,
        }),
        new TableCell({
          width: { size: mainPct, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.TOP,
          borders: noBorders,
          margins: { top: 170, bottom: 0, left: 220, right: 180 },
          children: mainChildren,
        }),
      ]})],
    }));
  }

  // ════ LAYOUT: sidebar-left (Creative Bold — the only template on this generic
  //   path; every other template has its own dedicated customLayout branch above) ═══
  // Spacing below is intentionally compact: this is the tallest sidebar layout
  // (photo + name + title + contacts + skills + languages + certifications all
  // stacked in one column, alongside a 2-entry experience + education main column),
  // and the previous, more generous spacing routinely pushed Education onto an
  // otherwise nearly-empty page 2 for realistic CV content.
  else {
    const sidebarBg = { fill: cfg.headerBg, type: ShadingType.SOLID, color: cfg.headerBg };
    const sidebarPct = cfg.sidebarPct || 33;
    const mainPct = 100 - sidebarPct;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sidebarChildren: any[] = [];
    if (photoBytes) sidebarChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: photoBytes, transformation: { width: photoW, height: photoH }, type: photoType })], spacing: { after: 90 } }));
    sidebarChildren.push(
      new Paragraph({ children: [new TextRun({ text: cvData.personal.fullName || 'Your Name', bold: true, size: 26, color: cfg.headerText })], spacing: { after: 30 } }),
      new Paragraph({ children: [new TextRun({ text: cvData.personal.jobTitle || '', size: 19, color: cfg.titleColor })], spacing: { after: 70 } }),
    );
    for (const c of contacts) sidebarChildren.push(new Paragraph({ children: [new TextRun({ text: c, size: 17, color: cfg.titleColor })], spacing: { after: 30 } }));
    if (cvData.personal.fathersName) sidebarChildren.push(new Paragraph({ children: [new TextRun({ text: `${t.cv.fathersName}: `, bold: true, size: 17, color: cfg.titleColor }), new TextRun({ text: cvData.personal.fathersName, size: 17, color: cfg.titleColor })], spacing: { after: 30 } }));
    if (cvData.skills.length > 0) {
      sidebarChildren.push(sidebarSectionHeading(t.cv.skills));
      const localizedSkills = cvData.skills.map((s) => getLocalizedCvSkillName(s, locale));
      for (const sk of localizedSkills) sidebarChildren.push(new Paragraph({ children: [new TextRun({ text: sk, size: 17, color: cfg.headerText })], spacing: { after: 28 } }));
    }
    if (cvData.languages.length > 0) {
      sidebarChildren.push(sidebarSectionHeading(t.cv.languages));
      for (const lang of cvData.languages) sidebarChildren.push(new Paragraph({ children: [new TextRun({ text: getLocalizedCvLanguageName(lang.name, locale), bold: true, size: 17, color: cfg.headerText }), new TextRun({ text: `  ${lang.level}`, size: 16, color: cfg.titleColor })], spacing: { after: 28 } }));
    }
    if (cvData.certifications.length > 0) {
      sidebarChildren.push(sidebarSectionHeading(t.cv.certifications));
      for (const cert of cvData.certifications) sidebarChildren.push(new Paragraph({ children: [new TextRun({ text: '• ' + cert, size: 17, color: cfg.headerText })], spacing: { after: 28 } }));
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mainChildren: any[] = [];
    const sidebarNoBorders = noBorders;
    function mainHeading(text: string) {
      const label = cfg.uppercaseHeadings !== false ? text.toUpperCase() : text;
      const borderConfig = cfg.showHeadingBorder !== false
        ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: cfg.headingBorder } }
        : {};
      return new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 17, color: cfg.headingColor })], spacing: { before: 0, after: 55 }, border: borderConfig });
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
      mainChildren.push(new Paragraph({ children: [new TextRun({ text: cvData.summary, size: 20, color: '374151' })], spacing: { after: 90 } }));
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
          mainChildren.push(new Paragraph({ children: [new TextRun({ text: exp.position, bold: true, size: 22, color: '111827' }), new TextRun({ text: '  —  ' + exp.company, size: 20, color: '6B7280' })], spacing: { after: 30 } }));
          mainChildren.push(new Paragraph({ children: [new TextRun({ text: dateText, size: 18, color: '9CA3AF', italics: true })], spacing: { after: 40 } }));
        }
        if (exp.description) {
          for (const line of exp.description.split('\n')) {
            if (line.trim()) mainChildren.push(new Paragraph({ children: [new TextRun({ text: line, size: 20, color: '374151' })], spacing: { after: 28 } }));
          }
        }
        mainChildren.push(new Paragraph({ text: '', spacing: { after: 50 } }));
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
          mainChildren.push(new Paragraph({ children: [new TextRun({ text: edu.degree, bold: true, size: 22, color: '111827' }), new TextRun({ text: '  —  ' + edu.school, size: 20, color: '6B7280' })], spacing: { after: 30 } }));
          if (edu.startDate || edu.endDate) mainChildren.push(new Paragraph({ children: [new TextRun({ text: `${edu.startDate} – ${edu.endDate}`, size: 18, color: '9CA3AF', italics: true })], spacing: { after: 40 } }));
        }
        if (edu.description) mainChildren.push(new Paragraph({ children: [new TextRun({ text: edu.description, size: 20, color: '374151' })], spacing: { after: 55 } }));
      }
    }

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ children: [
        new TableCell({ width: { size: sidebarPct, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, shading: sidebarBg, margins: { top: 180, bottom: 180, left: 240, right: 200 }, children: sidebarChildren }),
        new TableCell({ width: { size: mainPct, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP, borders: noBorders, margins: { top: 170, bottom: 170, left: 200, right: 240 }, children: mainChildren }),
      ]})],
      borders: noBorders,
    }));
  }

  // ── Build and download document ──────────────────────────────────────────────────────────────
  if (children.length === 0) {
    throw new SaveFailedError('DOCX export produced no content');
  }

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
          page: cfg.customLayout === 'executive-premium'
            ? { size: { width: 11906, height: 16838 }, margin: { top: 520, right: 620, bottom: 520, left: 620 } }
            : cfg.customLayout === 'corporate-navy' || cfg.customLayout === 'contemporary-bold'
              ? { size: { width: 11906, height: 16838 }, margin: { top: 520, right: 620, bottom: 520, left: 620 } }
              // Creative Bold's sidebar-left layout is the tallest generic layout (photo +
              // name + title + contacts + skills + languages + certifications all stacked in
              // one column) and previously used the wide 720-twip default margin, which was
              // the single biggest cause of Education overflowing onto an otherwise
              // nearly-empty page 2. Match the tighter margin already used by the other
              // dedicated dark-header layouts.
              : (templateId ?? cvData.templateId) === 'creative-bold'
                ? { margin: { top: 560, right: 620, bottom: 560, left: 620 } }
                // Professional Classic's default 720-twip margin (0.5in) was the widest of
                // any dedicated dark-header layout and was the main reason a long CV's
                // trailing Education/Skills/Certifications content spilled onto its own
                // near-empty final page. Tightening to the same 620-twip margin already
                // proven safe for creative-bold reclaims real content room on every page
                // without touching the header design, font sizes, or short-CV 1-page fit.
                : (templateId ?? cvData.templateId) === 'professional-classic'
                  ? { margin: { top: 620, right: 620, bottom: 620, left: 620 } }
                  // Creative Artistic's dedicated header table + left-border experience
                  // entries are similarly tall to professional-classic/creative-bold, and the
                  // same wide 720-twip default margin was the main reason a long CV's trailing
                  // Education/Skills spilled onto its own near-empty final page (Skills
                  // isolated below a split Education entry, mostly blank underneath). Reuse
                  // the same 620-twip margin already proven safe for professional-classic.
                  : (templateId ?? cvData.templateId) === 'creative-artistic'
                    ? { margin: { top: 620, right: 620, bottom: 620, left: 620 } }
                    : { margin: { top: 720, right: 720, bottom: 720, left: 720 } },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return await saveFileViaPlatform(blob, `${fileName}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

// ─── Rirekisho (Japanese CV) DOCX Export ─────────────────────────────────────

export async function exportRirekishoToDOCX(cvData: CVData, fileName: string): Promise<SaveFileResult> {
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
    TableLayoutType,
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
        const sy = isPortrait ? -(scaledH - outH) * 0.38 : (outH - scaledH) / 2;
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
  const rirekishoTableWidthDxa = 9360;
  const rirekishoPeriodColDxa = 2520;
  const rirekishoDetailColDxa = rirekishoTableWidthDxa - rirekishoPeriodColDxa;
  const rirekishoPersonalColWidths = [1200, 2600, 1000, 2640];
  const rirekishoPersonalWidthDxa = rirekishoPersonalColWidths.reduce((sum, width) => sum + width, 0);
  const rirekishoPhotoColDxa = rirekishoTableWidthDxa - rirekishoPersonalWidthDxa;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function fixedTable(rows: any[], columnWidths: number[], borders = noBorder) {
    return new Table({
      width: { size: columnWidths.reduce((sum, width) => sum + width, 0), type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths,
      borders,
      rows,
    });
  }

  function createPlaceholderPhotoDataUrl(width = 240, height = 320): string | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#f9fafb';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('写真', width / 2, height / 2);
    return canvas.toDataURL('image/png');
  }

  // FIX-12: MS Mincho east-Asia font wrapper
  function jpRun(text: string, opts: Record<string, unknown> = {}) {
    return new TextRun({ text, font: { eastAsia: 'MS Mincho' }, ...opts });
  }

  // Empty paragraph (spacer inside cells / between tables)
  function spacer(pts = 60) {
    return new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: pts } });
  }

  // ── Label cell (gray bg, left-aligned) ───────────────────────────────────
  function labelCell(text: string, widthDxa: number, colSpan?: number) {
    return new TableCell({
      width: { size: widthDxa, type: WidthType.DXA },
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
  function valueCell(text: string, widthDxa: number, colSpan?: number, size = 20) {
    return new TableCell({
      width: { size: widthDxa, type: WidthType.DXA },
      borders: thinBorder,
      verticalAlign: VerticalAlign.CENTER,
      ...(colSpan ? { columnSpan: colSpan } : {}),
      children: [
        new Paragraph({
          children: [jpRun(text || '　', { size, bold: !!text })],
          spacing: { before: 40, after: 40 },
        }),
      ],
    });
  }

  // ── Section heading row (full-width dark bar) ─────────────────────────────
  function sectionHeadingRow(kanji: string, options: { keepNext?: boolean } = {}) {
    return fixedTable(
      [
        new TableRow({
          children: [
            new TableCell({
              width: { size: rirekishoTableWidthDxa, type: WidthType.DXA },
              borders: thinBorder,
              shading: sectionBg,
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  keepNext: options.keepNext ?? false,
                  children: [jpRun(kanji, { bold: true, size: 24, color: 'FFFFFF' })],
                  spacing: { before: 60, after: 60 },
                }),
              ],
            }),
          ],
        }),
      ],
      [rirekishoTableWidthDxa],
      noBorder,
    );
  }

  function rirekishoLanguagesHeadingTableRow() {
    return new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          columnSpan: 2,
          width: { size: rirekishoTableWidthDxa, type: WidthType.DXA },
          borders: thinBorder,
          shading: sectionBg,
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              keepNext: true,
              keepLines: true,
              children: [jpRun('語学', { bold: true, size: 24, color: 'FFFFFF' })],
              spacing: { before: 60, after: 60 },
            }),
          ],
        }),
      ],
    });
  }

  function rirekishoLanguagesSectionTable() {
    const langHeaderRow = new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 4680, type: WidthType.DXA },
          borders: thinBorder,
          shading: headerBg,
          children: [new Paragraph({
            keepNext: true,
            keepLines: true,
            children: [jpRun('言語', { bold: true, size: 18, color: '374151' })],
            spacing: { before: 40, after: 40 },
          })],
        }),
        new TableCell({
          width: { size: 4680, type: WidthType.DXA },
          borders: thinBorder,
          shading: headerBg,
          children: [new Paragraph({
            keepNext: true,
            keepLines: true,
            children: [jpRun('レベル', { bold: true, size: 18, color: '374151' })],
            spacing: { before: 40, after: 40 },
          })],
        }),
      ],
    });
    const langDataRows = cvData.languages.map((lang, index) =>
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 4680, type: WidthType.DXA },
            borders: thinBorder,
            children: [new Paragraph({
              keepNext: index < cvData.languages.length - 1,
              keepLines: true,
              children: [jpRun(lang.name, { bold: true, size: 20 })],
              spacing: { before: 40, after: 40 },
            })],
          }),
          new TableCell({
            width: { size: 4680, type: WidthType.DXA },
            borders: thinBorder,
            children: [new Paragraph({
              keepNext: index < cvData.languages.length - 1,
              keepLines: true,
              children: [jpRun(lang.level || '', { size: 20, color: '4B5563' })],
              spacing: { before: 40, after: 40 },
            })],
          }),
        ],
      })
    );

    return new Table({
      width: { size: rirekishoTableWidthDxa, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [4680, 4680],
      borders: noBorder,
      rows: [rirekishoLanguagesHeadingTableRow(), langHeaderRow, ...langDataRows],
    });
  }

  // ── Content table row (期間 | details) ───────────────────────────────────
  function tableHeaderRow(col1: string, col2: string) {
    return new TableRow({
      children: [
        new TableCell({
          width: { size: rirekishoPeriodColDxa, type: WidthType.DXA },
          borders: thinBorder,
          shading: headerBg,
          children: [new Paragraph({ children: [jpRun(col1, { bold: true, size: 18, color: '374151' })], spacing: { before: 40, after: 40 } })],
        }),
        new TableCell({
          width: { size: rirekishoDetailColDxa, type: WidthType.DXA },
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
    fixedTable(
      [
        new TableRow({
          children: [
            new TableCell({
              width: { size: rirekishoTableWidthDxa, type: WidthType.DXA },
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
      [rirekishoTableWidthDxa],
      noBorder,
    )
  );

  children.push(spacer(80));

  // ── 2. PHOTO + PERSONAL INFO ──────────────────────────────────────────────
  const showPhoto = cvData.personal.photoEnabled !== undefined ? cvData.personal.photoEnabled : true;
  const personalPhotos = cvData.personal as CVData['personal'] & { originalPhoto?: string };
  const rawPhoto = showPhoto ? (personalPhotos.originalPhoto || cvData.personal.photo || null) : null;
  const croppedPhoto = rawPhoto ? await smartCropDataUrl(rawPhoto, 240, 320) : null;
  const placeholderPhoto = !croppedPhoto ? createPlaceholderPhotoDataUrl(240, 320) : null;
  const photoDataUrl = croppedPhoto || placeholderPhoto;
  const photoBytes = photoDataUrl ? dataUrlToBytes(photoDataUrl) : null;
  const photoType: 'png' | 'jpg' = photoDataUrl?.startsWith('data:image/png') ? 'png' : 'jpg';

  // Photo cell: image if present, else placeholder box with 写真 label
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photoCellChildren: any[] = [];
  if (photoBytes) {
    photoCellChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({ data: photoBytes, transformation: { width: 85, height: 113 }, type: photoType }),
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
        labelCell('氏名', rirekishoPersonalColWidths[0]),
        valueCell(cvData.personal.fullName || '', rirekishoPersonalColWidths[1] + rirekishoPersonalColWidths[2] + rirekishoPersonalColWidths[3], 3),
      ],
    }),
    // 生年月日 | 性別
    new TableRow({
      children: [
        labelCell('生年月日', rirekishoPersonalColWidths[0]),
        valueCell(cvData.personal.dateOfBirth || '', rirekishoPersonalColWidths[1]),
        labelCell('性別', rirekishoPersonalColWidths[2]),
        valueCell(cvData.personal.gender || '', rirekishoPersonalColWidths[3]),
      ],
    }),
    // 住所 full-width
    new TableRow({
      children: [
        labelCell('住所', rirekishoPersonalColWidths[0]),
        valueCell(cvData.personal.address || '', rirekishoPersonalColWidths[1] + rirekishoPersonalColWidths[2] + rirekishoPersonalColWidths[3], 3),
      ],
    }),
    // 電話番号 | メール
    new TableRow({
      children: [
        labelCell('電話番号', rirekishoPersonalColWidths[0]),
        valueCell(cvData.personal.phone || '', rirekishoPersonalColWidths[1], undefined, 18),
        labelCell('メール', rirekishoPersonalColWidths[2]),
        valueCell(cvData.personal.email || '', rirekishoPersonalColWidths[3], undefined, 17),
      ],
    }),
  ];

  const personalTable = fixedTable(personalRows, rirekishoPersonalColWidths, noBorder);

  // Outer layout: [personal info (75%) | photo (25%)]
  children.push(
    fixedTable(
      [
        new TableRow({
          children: [
            new TableCell({
              width: { size: rirekishoPersonalWidthDxa, type: WidthType.DXA },
              verticalAlign: VerticalAlign.TOP,
              borders: noBorder,
              children: [personalTable],
            }),
            new TableCell({
              width: { size: rirekishoPhotoColDxa, type: WidthType.DXA },
              verticalAlign: VerticalAlign.TOP,
              borders: thinBorder,
              children: photoCellChildren,
            }),
          ],
        }),
      ],
      [rirekishoPersonalWidthDxa, rirekishoPhotoColDxa],
      noBorder,
    )
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
              width: { size: rirekishoPeriodColDxa, type: WidthType.DXA },
              borders: thinBorder,
              verticalAlign: VerticalAlign.TOP,
              children: [new Paragraph({ children: [jpRun(period, { size: 18, color: '6B7280' })], spacing: { before: 40, after: 40 } })],
            }),
            new TableCell({
              width: { size: rirekishoDetailColDxa, type: WidthType.DXA },
              borders: thinBorder,
              verticalAlign: VerticalAlign.TOP,
              children: detailParas,
            }),
          ],
        })
      );
    }
    children.push(fixedTable(eduRows, [rirekishoPeriodColDxa, rirekishoDetailColDxa], noBorder));
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
              width: { size: rirekishoPeriodColDxa, type: WidthType.DXA },
              borders: thinBorder,
              verticalAlign: VerticalAlign.TOP,
              children: [new Paragraph({ children: [jpRun(period, { size: 18, color: '6B7280' })], spacing: { before: 40, after: 40 } })],
            }),
            new TableCell({
              width: { size: rirekishoDetailColDxa, type: WidthType.DXA },
              borders: thinBorder,
              verticalAlign: VerticalAlign.TOP,
              children: detailParas,
            }),
          ],
        })
      );
    }
    children.push(fixedTable(expRows, [rirekishoPeriodColDxa, rirekishoDetailColDxa], noBorder));
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
    children.push(fixedTable(skillRows, [4680, 4680], noBorder));
    children.push(spacer(80));
  }

  // ── 6. LANGUAGES 語学 (one per row: Language | Level) ─────────────────────
  if (cvData.languages.length > 0) {
    children.push(rirekishoLanguagesSectionTable());
    children.push(spacer(80));
  }

  // ── 7. SUMMARY 自己PR (inside table cell) ────────────────────────────────
  if (cvData.summary) {
    children.push(sectionHeadingRow('自己PR'));
    children.push(
      fixedTable(
        [
          new TableRow({
            children: [
              new TableCell({
                width: { size: rirekishoTableWidthDxa, type: WidthType.DXA },
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
        [rirekishoTableWidthDxa],
        noBorder,
      )
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
    children.push(fixedTable(certRows, [rirekishoTableWidthDxa], noBorder));
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
  return await saveFileViaPlatform(blob, `${fileName}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
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

export function isCanvasSliceEffectivelyBlank(canvas: HTMLCanvasElement, offsetY: number, sliceHeight: number): boolean {
  const width = canvas.width;
  const sourceY = Math.max(0, Math.ceil(offsetY));
  const height = Math.max(0, Math.min(Math.ceil(sliceHeight), canvas.height - sourceY));
  if (width <= 0 || height <= 0) return true;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const sampleStep = Math.max(4, Math.floor(width / 80));
  const data = ctx.getImageData(0, sourceY, width, height).data;
  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha === 0) continue;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (red < 248 || green < 248 || blue < 248) return false;
    }
  }
  return true;
}

function isCreativeBoldSidebarBackground(red: number, green: number, blue: number): boolean {
  return red >= 150 && red <= 235 && green <= 85 && blue >= 45 && blue <= 145;
}

function isNearWhite(red: number, green: number, blue: number): boolean {
  return red >= 248 && green >= 248 && blue >= 248;
}

function isCloseColor(
  red: number,
  green: number,
  blue: number,
  baseRed: number,
  baseGreen: number,
  baseBlue: number,
  tolerance: number,
): boolean {
  return Math.abs(red - baseRed) <= tolerance
    && Math.abs(green - baseGreen) <= tolerance
    && Math.abs(blue - baseBlue) <= tolerance;
}

function isMeaningfulCreativeBoldPixel(
  red: number,
  green: number,
  blue: number,
  x: number,
  sidebarWidth: number,
  sidebarRowBackground: [number, number, number] | null,
): boolean {
  if (x < sidebarWidth) {
    if (
      sidebarRowBackground
      && isCloseColor(red, green, blue, sidebarRowBackground[0], sidebarRowBackground[1], sidebarRowBackground[2], 12)
    ) {
      return false;
    }
    if (!sidebarRowBackground && isNearWhite(red, green, blue)) return false;
    return true;
  }

  if (x <= sidebarWidth + 2 && isCreativeBoldSidebarBackground(red, green, blue)) return false;
  if (isNearWhite(red, green, blue)) return false;
  return true;
}

export function isCreativeBoldCanvasSliceEffectivelyBlank(canvas: HTMLCanvasElement, offsetY: number, sliceHeight: number): boolean {
  const width = canvas.width;
  const sourceY = Math.max(0, Math.ceil(offsetY));
  const height = Math.max(0, Math.min(Math.ceil(sliceHeight), canvas.height - sourceY));
  if (width <= 0 || height <= 0) return true;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const sidebarWidth = Math.round(width * (CREATIVE_BOLD_PDF_SIDEBAR_PERCENT / 100));
  const data = ctx.getImageData(0, sourceY, width, height).data;
  for (let y = 0; y < height; y += 1) {
    let sidebarRowBackground: [number, number, number] | null = null;
    for (let bgX = 0; bgX < sidebarWidth; bgX += 1) {
      const bgIndex = (y * width + bgX) * 4;
      if (data[bgIndex + 3] === 0) continue;
      if (isCreativeBoldSidebarBackground(data[bgIndex], data[bgIndex + 1], data[bgIndex + 2])) {
        sidebarRowBackground = [data[bgIndex], data[bgIndex + 1], data[bgIndex + 2]];
        break;
      }
    }

    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha === 0) continue;
      if (isMeaningfulCreativeBoldPixel(data[index], data[index + 1], data[index + 2], x, sidebarWidth, sidebarRowBackground)) {
        return false;
      }
    }
  }
  return true;
}

export type CreativeBoldPdfSliceSegment = {
  startPx: number;
  endPx: number;
};

function getCreativeBoldMainColumnBounds(
  canvasWidthPx: number,
  cssToCanvasScale: number,
): { leftPx: number; rightPx: number } {
  const sidebarWidthPx = Math.round(canvasWidthPx * (CREATIVE_BOLD_PDF_SIDEBAR_PERCENT / 100));
  const guardPx = Math.max(1, Math.round(CREATIVE_BOLD_PDF_MAIN_COLUMN_GUARD_CSS_PX * cssToCanvasScale));
  return {
    leftPx: Math.min(canvasWidthPx - 1, sidebarWidthPx + guardPx),
    rightPx: canvasWidthPx,
  };
}

export function isCreativeBoldMainColumnRowWhitespace(
  canvas: HTMLCanvasElement,
  rowY: number,
  leftPx: number,
  rightPx: number,
): boolean {
  const width = canvas.width;
  const height = canvas.height;
  if (width <= 0 || height <= 0) return true;
  const y = Math.max(0, Math.min(height - 1, Math.round(rowY)));
  const left = Math.max(0, Math.min(width - 1, Math.floor(leftPx)));
  const right = Math.max(left + 1, Math.min(width, Math.ceil(rightPx)));
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const data = ctx.getImageData(left, y, right - left, 1).data;
  for (let x = 0; x < right - left; x += 1) {
    const index = x * 4;
    const alpha = data[index + 3];
    if (alpha === 0) continue;
    if (!isNearWhite(data[index], data[index + 1], data[index + 2])) return false;
  }
  return true;
}

function findCreativeBoldWhitespaceBandCenter(
  canvas: HTMLCanvasElement,
  targetBreakPx: number,
  minBreakPx: number,
  maxBreakPx: number,
  searchRangePx: number,
  minBandHeightPx: number,
  leftPx: number,
  rightPx: number,
): number | null {
  const height = canvas.height;
  const lower = Math.max(
    Math.ceil(minBreakPx),
    Math.ceil(targetBreakPx - searchRangePx),
    1,
  );
  const upper = Math.min(
    Math.floor(maxBreakPx),
    Math.floor(targetBreakPx + searchRangePx),
    height - 1,
  );
  if (upper <= lower) return null;

  const rowCount = upper - lower + 1;
  const unsafeRows = new Uint8Array(rowCount);
  const inkGuardPx = Math.max(4, Math.round(minBandHeightPx));
  for (let y = lower; y <= upper; y += 1) {
    if (isCreativeBoldMainColumnRowWhitespace(canvas, y, leftPx, rightPx)) continue;
    const unsafeStart = Math.max(lower, y - inkGuardPx);
    const unsafeEnd = Math.min(upper, y + inkGuardPx);
    for (let unsafeY = unsafeStart; unsafeY <= unsafeEnd; unsafeY += 1) {
      unsafeRows[unsafeY - lower] = 1;
    }
  }

  const bands: Array<{ start: number; end: number; center: number }> = [];
  let bandStart: number | null = null;
  for (let y = lower; y <= upper; y += 1) {
    if (unsafeRows[y - lower] === 0) {
      if (bandStart === null) bandStart = y;
      continue;
    }
    if (bandStart !== null && y - bandStart >= minBandHeightPx) {
      const center = Math.round((bandStart + y - 1) / 2);
      bands.push({ start: bandStart, end: y - 1, center });
    }
    bandStart = null;
  }
  if (bandStart !== null && upper - bandStart + 1 >= minBandHeightPx) {
    const center = Math.round((bandStart + upper) / 2);
    bands.push({ start: bandStart, end: upper, center });
  }
  if (bands.length === 0) return null;

  const earlierOrAtTarget = bands
    .filter(band => band.center <= targetBreakPx)
    .sort((a, b) => Math.abs(a.center - targetBreakPx) - Math.abs(b.center - targetBreakPx));
  if (earlierOrAtTarget.length > 0) return earlierOrAtTarget[0].center;

  return bands
    .sort((a, b) => Math.abs(a.center - targetBreakPx) - Math.abs(b.center - targetBreakPx))[0]
    .center;
}

export function resolveCreativeBoldSafePageBreakCanvasPx(
  canvas: HTMLCanvasElement,
  targetBreakPx: number,
  minBreakPx: number,
  maxBreakPx: number,
  searchRangePx: number,
  minBandHeightPx: number,
  leftPx: number,
  rightPx: number,
): number {
  const whitespaceBreak = findCreativeBoldWhitespaceBandCenter(
    canvas,
    targetBreakPx,
    minBreakPx,
    maxBreakPx,
    searchRangePx,
    minBandHeightPx,
    leftPx,
    rightPx,
  );
  if (whitespaceBreak !== null && whitespaceBreak > minBreakPx) return whitespaceBreak;

  // Last resort: never advance through a row containing main-column ink. Walk upward
  // from the target so the current page gets a safer bottom gap rather than a cut line.
  const lower = Math.max(1, Math.ceil(minBreakPx));
  const start = Math.min(canvas.height - 1, Math.floor(targetBreakPx));
  for (let y = start; y >= lower; y -= 1) {
    let safe = true;
    const guard = Math.max(2, Math.round(minBandHeightPx / 2));
    for (let guardY = Math.max(lower, y - guard); guardY <= Math.min(canvas.height - 1, y + guard); guardY += 1) {
      if (!isCreativeBoldMainColumnRowWhitespace(canvas, guardY, leftPx, rightPx)) {
        safe = false;
        break;
      }
    }
    if (safe) return y;
  }
  return Math.max(minBreakPx + 1, Math.min(targetBreakPx, maxBreakPx));
}

export function planCreativeBoldPdfSliceSegments(
  canvasHeightPx: number,
  pageHeightPx: number,
  trailingTolerancePx: number,
  pdfCanvas: HTMLCanvasElement,
  topInsetCanvasPx: number,
  bottomInsetCanvasPx: number,
  searchRangeCanvasPx: number,
  minWhitespaceBandCanvasPx: number,
  cssToCanvasScale: number,
): CreativeBoldPdfSliceSegment[] {
  const segments: CreativeBoldPdfSliceSegment[] = [];
  const { leftPx, rightPx } = getCreativeBoldMainColumnBounds(pdfCanvas.width, cssToCanvasScale);
  let offsetY = 0;
  let pageIndex = 0;

  while (offsetY < canvasHeightPx - trailingTolerancePx) {
    const topInset = pageIndex > 0 ? topInsetCanvasPx : 0;
    const contentBudgetPx = Math.max(1, pageHeightPx - topInset - bottomInsetCanvasPx);
    let sliceHeight = Math.min(contentBudgetPx, canvasHeightPx - offsetY);

    if (offsetY + sliceHeight < canvasHeightPx - trailingTolerancePx) {
      const targetBreakPx = offsetY + sliceHeight;
      const minBreakPx = offsetY + Math.max(1, Math.min(contentBudgetPx * 0.45, contentBudgetPx - 1));
      const maxBreakPx = Math.min(canvasHeightPx, offsetY + contentBudgetPx);
      const breakPx = resolveCreativeBoldSafePageBreakCanvasPx(
        pdfCanvas,
        targetBreakPx,
        minBreakPx,
        maxBreakPx,
        searchRangeCanvasPx,
        minWhitespaceBandCanvasPx,
        leftPx,
        rightPx,
      );
      if (breakPx > offsetY + PDF_PAGE_INTERSECTION_EPSILON_PX) {
        sliceHeight = breakPx - offsetY;
      }
    }

    segments.push({ startPx: offsetY, endPx: offsetY + sliceHeight });
    offsetY += sliceHeight;
    pageIndex += 1;
  }

  return segments;
}

export type CreativeArtisticPdfSliceSegment = {
  startPx: number;
  endPx: number;
};

function getCreativeArtisticContentBounds(
  canvasWidthPx: number,
  cssToCanvasScale: number,
): { leftPx: number; rightPx: number } {
  const guardPx = Math.max(1, Math.round(CREATIVE_ARTISTIC_PDF_CONTENT_GUARD_CSS_PX * cssToCanvasScale));
  return {
    leftPx: guardPx,
    rightPx: Math.max(guardPx + 1, canvasWidthPx - guardPx),
  };
}

export function isCreativeArtisticContentRowWhitespace(
  canvas: HTMLCanvasElement,
  rowY: number,
  leftPx: number,
  rightPx: number,
): boolean {
  return isCreativeBoldMainColumnRowWhitespace(canvas, rowY, leftPx, rightPx);
}

export function resolveCreativeArtisticSafePageBreakCanvasPx(
  canvas: HTMLCanvasElement,
  targetBreakPx: number,
  minBreakPx: number,
  maxBreakPx: number,
  searchRangePx: number,
  minBandHeightPx: number,
  leftPx: number,
  rightPx: number,
): number {
  const whitespaceBreak = findCreativeBoldWhitespaceBandCenter(
    canvas,
    targetBreakPx,
    minBreakPx,
    maxBreakPx,
    searchRangePx,
    minBandHeightPx,
    leftPx,
    rightPx,
  );
  if (whitespaceBreak !== null && whitespaceBreak > minBreakPx) return whitespaceBreak;

  const lower = Math.max(1, Math.ceil(minBreakPx));
  const start = Math.min(canvas.height - 1, Math.floor(targetBreakPx));
  for (let y = start; y >= lower; y -= 1) {
    let safe = true;
    const guard = Math.max(2, Math.round(minBandHeightPx / 2));
    for (let guardY = Math.max(lower, y - guard); guardY <= Math.min(canvas.height - 1, y + guard); guardY += 1) {
      if (!isCreativeArtisticContentRowWhitespace(canvas, guardY, leftPx, rightPx)) {
        safe = false;
        break;
      }
    }
    if (safe) return y;
  }
  return Math.max(minBreakPx + 1, Math.min(targetBreakPx, maxBreakPx));
}

export function planCreativeArtisticPdfSliceSegments(
  canvasHeightPx: number,
  pageHeightPx: number,
  trailingTolerancePx: number,
  pdfCanvas: HTMLCanvasElement,
  topInsetCanvasPx: number,
  bottomInsetCanvasPx: number,
  searchRangeCanvasPx: number,
  minWhitespaceBandCanvasPx: number,
  cssToCanvasScale: number,
): CreativeArtisticPdfSliceSegment[] {
  const segments: CreativeArtisticPdfSliceSegment[] = [];
  const { leftPx, rightPx } = getCreativeArtisticContentBounds(pdfCanvas.width, cssToCanvasScale);
  let offsetY = 0;
  let pageIndex = 0;

  while (offsetY < canvasHeightPx - trailingTolerancePx) {
    const topInset = pageIndex > 0 ? topInsetCanvasPx : 0;
    const contentBudgetPx = Math.max(1, pageHeightPx - topInset - bottomInsetCanvasPx);
    let sliceHeight = Math.min(contentBudgetPx, canvasHeightPx - offsetY);

    if (offsetY + sliceHeight < canvasHeightPx - trailingTolerancePx) {
      const targetBreakPx = offsetY + sliceHeight;
      const minBreakPx = offsetY + Math.max(1, Math.min(contentBudgetPx * 0.45, contentBudgetPx - 1));
      const maxBreakPx = Math.min(canvasHeightPx, offsetY + contentBudgetPx);
      const breakPx = resolveCreativeArtisticSafePageBreakCanvasPx(
        pdfCanvas,
        targetBreakPx,
        minBreakPx,
        maxBreakPx,
        searchRangeCanvasPx,
        minWhitespaceBandCanvasPx,
        leftPx,
        rightPx,
      );
      if (breakPx > offsetY + PDF_PAGE_INTERSECTION_EPSILON_PX) {
        sliceHeight = breakPx - offsetY;
      }
    }

    segments.push({ startPx: offsetY, endPx: offsetY + sliceHeight });
    offsetY += sliceHeight;
    pageIndex += 1;
  }

  return segments;
}

function isTemplateCanvasSliceEffectivelyBlank(
  canvas: HTMLCanvasElement,
  offsetY: number,
  sliceHeight: number,
  templateId: StyledPdfTemplateId | null,
): boolean {
  if (templateId === 'creative-bold') {
    return isCreativeBoldCanvasSliceEffectivelyBlank(canvas, offsetY, sliceHeight);
  }
  return isCanvasSliceEffectivelyBlank(canvas, offsetY, sliceHeight);
}

export function findVisibleCanvasBottom(canvas: HTMLCanvasElement): number {
  const width = canvas.width;
  const height = canvas.height;
  if (width <= 0 || height <= 0) return height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return height;
  const sampleStep = Math.max(3, Math.floor(width / 100));
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let y = height - 1; y >= 0; y -= sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      if (alpha === 0) continue;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (red < 248 || green < 248 || blue < 248) return Math.min(height, y + sampleStep);
    }
  }
  return height;
}

function getSemanticCanvasBottom(
  bounds: MeaningfulContentBounds | null,
  canvasWidthPx: number,
  fallbackCssWidthPx: number,
): number | null {
  if (!bounds || canvasWidthPx <= 0) return null;
  const cssWidth = bounds.rootWidthCssPx || fallbackCssWidthPx;
  if (cssWidth <= 0) return null;
  const scalePxPerCssPx = canvasWidthPx / cssWidth;
  return Math.ceil(bounds.maxBottomCssPx * scalePxPerCssPx + SEMANTIC_CANVAS_BOTTOM_PADDING_PX);
}

export type CvPdfContinuationSliceInsets = {
  topInsetCssPx: number;
  bottomInsetCssPx: number;
};

export type BuildCvPdfBlobOptions = {
  /** Bypass DOM marker detection when export wiring must not rely on WebView dataset/querySelector. */
  forcedCaptureTemplateId?: StyledPdfTemplateId;
  /** Explicit continuation-page padding profile; cannot be neutralized by failed DOM detection. */
  continuationSliceInsets?: CvPdfContinuationSliceInsets;
  /** Embedded in PDF metadata to verify the exported file came from this build path. */
  pdfBuildCanary?: string;
};

export async function readPdfBlobAsLatin1Text(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return new TextDecoder('latin1').decode(buffer);
}

export type CvPdfExportRoute =
  | { kind: 'dedicated-clean-simple' }
  | { kind: 'dedicated-professional-classic' }
  | { kind: 'dedicated-creative-bold' }
  | { kind: 'dedicated-creative-artistic' }
  | { kind: 'dedicated-elegant-formal' }
  | { kind: 'dedicated-ats-standard' }
  | { kind: 'dedicated-modern-minimal' }
  | { kind: 'generic-preview' };

export function resolveCvPdfExportRoute(templateId: CVData['templateId']): CvPdfExportRoute {
  if (templateId === 'clean-simple') return { kind: 'dedicated-clean-simple' };
  if (templateId === 'professional-classic') return { kind: 'dedicated-professional-classic' };
  if (templateId === 'creative-bold') return { kind: 'dedicated-creative-bold' };
  if (templateId === 'creative-artistic') return { kind: 'dedicated-creative-artistic' };
  if (templateId === 'elegant-formal') return { kind: 'dedicated-elegant-formal' };
  if (templateId === 'ats-standard') return { kind: 'dedicated-ats-standard' };
  if (templateId === 'modern-minimal') return { kind: 'dedicated-modern-minimal' };
  if (
    templateId === 'executive-premium'
    || templateId === 'nordic-clean'
    || templateId === 'tech-sidebar'
    || templateId === 'corporate-navy'
    || templateId === 'contemporary-bold'
    || templateId === 'rirekisho'
  ) {
    return { kind: 'generic-preview' };
  }
  return { kind: 'generic-preview' };
}

/**
 * V11: no `pdfBuildCanary` here — production Clean Simple exports must not embed any
 * debug/build-tag metadata in the real output PDF. Tests that want to tag a build for
 * their own isolated assertions can still pass `pdfBuildCanary` explicitly to
 * `buildCvPdfBlob`/`buildCleanSimplePdfBlob`.
 */
export function getCleanSimplePdfExportBuildOptions(): BuildCvPdfBlobOptions {
  return {
    forcedCaptureTemplateId: 'clean-simple',
    continuationSliceInsets: {
      topInsetCssPx: CLEAN_SIMPLE_PDF_PAGE_TOP_INSET_CSS_PX,
      bottomInsetCssPx: CLEAN_SIMPLE_PDF_PAGE_BOTTOM_INSET_CSS_PX,
    },
  };
}

export function resolveCvPdfCaptureTemplateId(
  element: HTMLElement,
  options: BuildCvPdfBlobOptions = {},
): StyledPdfTemplateId | null {
  if (options.forcedCaptureTemplateId) return options.forcedCaptureTemplateId;
  const captureTarget = (element.firstElementChild as HTMLElement | null) ?? element;
  return getExportStyleTemplateId(captureTarget) ?? getExportStyleTemplateId(element);
}

export async function buildCvPdfBlob(
  elementId: string,
  options: BuildCvPdfBlobOptions = {},
): Promise<Blob> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`PDF export: element #${elementId} not found in DOM`);
  const forcedCaptureTemplateId = options.forcedCaptureTemplateId ?? null;
  const explicitContinuationSliceInsets = options.continuationSliceInsets ?? null;
  const pdfBuildCanary = options.pdfBuildCanary ?? null;

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

  const initialCaptureTarget = (element.firstElementChild as HTMLElement | null) ?? element;
  const initialCaptureTemplateId = forcedCaptureTemplateId
    ?? getExportStyleTemplateId(initialCaptureTarget)
    ?? getExportStyleTemplateId(element);
  const captureFontFamily = initialCaptureTemplateId === 'ats-standard'
    ? 'Arial, Helvetica, sans-serif'
    : initialCaptureTemplateId === 'executive-premium'
      ? 'Georgia, "Times New Roman", serif'
      : initialCaptureTemplateId === 'nordic-clean' || initialCaptureTemplateId === 'tech-sidebar' || initialCaptureTemplateId === 'corporate-navy' || initialCaptureTemplateId === 'contemporary-bold'
        ? 'Arial, Helvetica, NotoSans, NotoSansArabic, NotoSansDevanagari, NotoSansJP, sans-serif'
        : "'NotoSans', 'NotoSansArabic', 'NotoSansDevanagari', 'NotoSansJP', sans-serif";

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
  element.style.fontFamily = captureFontFamily;

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
    firstChild.style.fontFamily = captureFontFamily;
  }

  const scale = 2;

  // ── Step 4c: flush two animation frames so any pending React state updates
  //    (e.g. rectPhotoUrl injection into localizedPreviewCv) have painted to the DOM
  //    before html2canvas reads the <img src> attributes.
  await document.fonts.ready;
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  // ── Visual debug: stamp a red border + label on every <img> that html2canvas
  //    will capture (dev-only). This lets you see in the live preview EXACTLY which image
  //    node is being used before the PDF is generated.
  const debugOverlays: Array<{ el: HTMLImageElement; prevOutline: string; prevPosition: string }> = [];
  const debugLabels: HTMLElement[] = [];
  if (false && process.env.NODE_ENV !== 'production') {
    const allImgs = (element as HTMLElement).querySelectorAll('img');
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
  let preparedImages: PreparedExportImage[] = [];
  const exportCaptureId = `cv-template-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let taggedCaptureTarget: HTMLElement | null = null;
  let captureTemplateId: StyledPdfTemplateId | null = null;
  let semanticMeaningfulBounds: MeaningfulContentBounds | null = null;
  let captureWidth = 0;
  let captureHeight = 0;
  let sourceStyleSnapshots: InlineStyleSnapshot[] = [];
  let elegantFormalTextLineIntervalsCss: ElegantFormalTextLineIntervalCss[] | null = null;
  const elegantFormalPageBreakSources: string[] = [];
  let techSidebarTextLineIntervalsCss: ElegantFormalTextLineIntervalCss[] | null = null;
  let techSidebarMainColumnBoundsCss: { leftCssPx: number; rightCssPx: number } | null = null;
  const techSidebarPageBreakSources: string[] = [];
  let rirekishoTextLineIntervalsCss: ElegantFormalTextLineIntervalCss[] | null = null;
  let rirekishoContentBoundsCss: { leftCssPx: number; rightCssPx: number } | null = null;
  const rirekishoPageBreakSources: string[] = [];
  let cleanSimpleTextLineIntervalsCss: ElegantFormalTextLineIntervalCss[] | null = null;
  let cleanSimpleSummarySentenceSpansCss: ElegantFormalTextLineIntervalCss[] | null = null;
  try {
    // ── HARD VERIFICATION: capture the actual template child directly, not the
    //    scroll wrapper. The #cv-preview / #cv-inline-preview div is an
    //    overflow-auto container — html2canvas on that wrapper can silently clip
    //    to the visible viewport and miss styles on the child template element.
    //    By targeting the template child directly we guarantee we capture exactly
    //    what is rendered, including any background-color changes.
    const captureTarget = (firstChild as HTMLElement | null) ?? element;
    captureTemplateId = forcedCaptureTemplateId
      ?? getExportStyleTemplateId(captureTarget)
      ?? getExportStyleTemplateId(element);
    const sourceRootForTag = captureTemplateId ? getTemplateCaptureRoot(captureTarget, captureTemplateId) : null;
    if (captureTemplateId === 'elegant-formal' && sourceRootForTag) {
      sourceStyleSnapshots = snapshotInlineStyles(sourceRootForTag);
      applyElegantFormalPdfLayout(sourceRootForTag);
      normalizeElegantFormalPdfTextStyles(sourceRootForTag);
      applyElegantFormalPdfNoWrapItems(sourceRootForTag);
      void sourceRootForTag.offsetHeight;
      applyElegantFormalKeepTogetherPagination(sourceRootForTag);
      elegantFormalTextLineIntervalsCss = collectElegantFormalTextLineIntervalsCss(sourceRootForTag);
    }
    if (captureTemplateId === 'tech-sidebar' && sourceRootForTag) {
      void sourceRootForTag.offsetHeight;
      techSidebarTextLineIntervalsCss = collectTechSidebarMainColumnTextLineIntervalsCss(sourceRootForTag);
      techSidebarMainColumnBoundsCss = getTechSidebarMainColumnContentBoundsCss(sourceRootForTag);
    }
    if (captureTemplateId === 'corporate-navy' && sourceRootForTag) {
      void sourceRootForTag.offsetHeight;
      applyCorporateNavyKeepTogetherPagination(sourceRootForTag);
    }
    if (captureTemplateId === 'contemporary-bold' && sourceRootForTag) {
      void sourceRootForTag.offsetHeight;
      applyContemporaryBoldKeepTogetherPagination(sourceRootForTag);
    }
    if (captureTemplateId === 'modern-minimal' && sourceRootForTag) {
      void sourceRootForTag.offsetHeight;
      applyModernMinimalKeepTogetherPagination(sourceRootForTag);
    }
    if (captureTemplateId === 'rirekisho' && sourceRootForTag) {
      void sourceRootForTag.offsetHeight;
      applyRirekishoKeepTogetherPagination(sourceRootForTag);
      rirekishoTextLineIntervalsCss = collectElegantFormalTextLineIntervalsCss(sourceRootForTag);
      rirekishoContentBoundsCss = getRirekishoPdfContentBoundsCss(sourceRootForTag);
    }
    if (captureTemplateId === 'professional-classic' && sourceRootForTag) {
      // Must run on the real (pre-clone) source root, not only inside onclone: the
      // keep-together pass can push a short trailing group (e.g. Certifications) down
      // with extra margin to avoid a mid-heading split, which *increases* total document
      // height. captureWidth/captureHeight below are what fixes the html2canvas output
      // canvas size — measuring them before this pass ran previously left the canvas too
      // short, silently clipping whatever the shift pushed past the original bottom edge.
      applyProfessionalClassicKeepTogetherPagination(sourceRootForTag);
      applyProfessionalClassicFinalPageBalance(sourceRootForTag);
    }
    if (captureTemplateId === 'creative-bold' && sourceRootForTag) {
      // Same reasoning as professional-classic above: run keep-together on the real
      // (pre-clone) source root so captureWidth/captureHeight below already reflect any
      // margin-top shift, instead of sizing the canvas before the shift is applied and
      // clipping whatever content the shift pushed past the original bottom edge.
      applyCreativeBoldKeepTogetherPagination(sourceRootForTag);
    }
    if (captureTemplateId === 'creative-artistic' && sourceRootForTag) {
      // Same reasoning as professional-classic/creative-bold above: the new Work
      // Experience header/line keep-together shifts (added alongside the existing
      // education-section/skills-block whole-block shifts) must run before
      // captureWidth/captureHeight are measured below, so the canvas is sized to fit
      // whatever those shifts pushed past the original bottom edge instead of clipping
      // it. Safe to mutate directly: this source root is always a disposable,
      // off-screen export-only container (buildCreativeArtisticPdfBlob), never the live
      // preview DOM.
      //
      // Layout/text-style normalization must run here too, in the exact same order as
      // the onclone block below, BEFORE the keep-together pass. Previously
      // applyCreativeArtisticPdfLayout/normalizeCreativeArtisticPdfTextStyles/
      // applyCreativeArtisticPdfNoWrapItems only ran inside onclone, so the pre-clone
      // keep-together pass computed its shifts against the template's raw (un-
      // normalized) geometry — e.g. the template's own `body` padding ('22px 28px
      // 26px') — while onclone's own layout pass then forcibly overwrote that same
      // padding to a flat 32px and reset word-spacing/letter-spacing to `normal`
      // before re-running keep-together a second time against the now-different
      // geometry. That mismatch is exactly why captureHeight (measured below, from the
      // pre-clone pass) didn't match what onclone's second pass actually produced:
      // a page could end up with extra blank space (pre-clone shift computed against
      // shorter boxes than what onclone rendered) or a colliding entry (pre-clone
      // shift computed against taller boxes than onclone rendered, leaving too little
      // margin). Running the identical normalization here first makes both passes
      // operate on identical geometry, so onclone's repeat of these same calls below
      // is a no-op and its keep-together pass reproduces this one exactly.
      applyCreativeArtisticPdfLayout(sourceRootForTag);
      normalizeCreativeArtisticPdfTextStyles(sourceRootForTag);
      applyCreativeArtisticPdfNoWrapItems(sourceRootForTag);
      void sourceRootForTag.offsetHeight;
      applyCreativeArtisticKeepTogetherPagination(sourceRootForTag);
    }
    if (captureTemplateId === 'clean-simple' && sourceRootForTag) {
      void sourceRootForTag.offsetHeight;
      const cleanSimplePaginationReport = applyCleanSimpleKeepTogetherPagination(sourceRootForTag);
      if (typeof window !== 'undefined') {
        (window as typeof window & {
          __cleanSimpleBlockPaginationReport?: CleanSimpleBlockPaginationReport;
        }).__cleanSimpleBlockPaginationReport = cleanSimplePaginationReport;
      }
      // Must run after keep-together so measured line positions already reflect any
      // margin-top shifts that pass applied, and before html2canvas rasterizes the
      // page — this walks the *real* DOM (Range.getClientRects()) to find every actual
      // rendered text line, which is what lets slice planning below choose a page break
      // at a genuine line boundary instead of a rasterized-pixel guess.
      cleanSimpleTextLineIntervalsCss = collectElegantFormalTextLineIntervalsCss(sourceRootForTag);
      // Same real-DOM measurement pass, but per-sentence rather than per-line: lets the
      // slice planner recognize when a line-safe break would still land inside a single
      // sentence (e.g. after just its first line/word) and prefer breaking before that
      // sentence starts instead. Never mutates the DOM.
      cleanSimpleSummarySentenceSpansCss = collectCleanSimpleSummarySentenceSpansCss(sourceRootForTag);
    }
    captureWidth = Math.max(captureTarget.scrollWidth, captureTarget.offsetWidth);
    captureHeight = Math.max(captureTarget.scrollHeight, captureTarget.offsetHeight);
    preparedImages = await prepareTemplateImagesForExport(captureTarget);
    if (captureTemplateId === 'creative-artistic' && captureWidth > 0) {
      captureHeight += Math.ceil(captureWidth * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM) * 2);
    }
    if (sourceRootForTag) {
      taggedCaptureTarget = sourceRootForTag;
      taggedCaptureTarget.setAttribute('data-export-capture-id', exportCaptureId);
    }

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
      onclone: (clonedDocument) => {
        if (!captureTemplateId) return;
        const sourceRoot = getTemplateCaptureRoot(captureTarget, captureTemplateId);
        const cloneRoot = clonedDocument.querySelector(`[data-export-capture-id="${exportCaptureId}"]`) as HTMLElement | null;
        if (!sourceRoot || !cloneRoot) return;
        copyTemplateComputedStyles(sourceRoot, cloneRoot, captureTemplateId);
        if (captureTemplateId === 'professional-classic') {
          normalizeProfessionalClassicPdfTextStyles(cloneRoot);
          applyProfessionalClassicKeepTogetherPagination(cloneRoot);
          applyProfessionalClassicFinalPageBalance(cloneRoot);
          // Professional Classic previously relied on pure fixed-height canvas
          // slicing with no page-break awareness at all, which for multipage
          // content produced a nearly-empty trailing page (e.g. Education +
          // Skills alone) whenever their small combined height spilled just
          // past a page boundary. Measuring real content bounds and building a
          // page plan lets the paginator skip/merge page ranges with no
          // meaningful content instead of always emitting one blank-ish page
          // per leftover sliver — the same fix already applied to
          // executive-premium/nordic-clean/tech-sidebar/corporate-navy/
          // contemporary-bold/rirekisho/ats-standard.
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'creative-bold') {
          applyCreativeBoldPdfLayout(cloneRoot);
          normalizeCreativeBoldPdfTextStyles(cloneRoot);
          applyCreativeBoldKeepTogetherPagination(cloneRoot);
          // Bring creative-bold in line with every other multipage template: expand the
          // captured root to the true measured bottom of meaningful content so the
          // semantic page-plan (skip/merge blank trailing page ranges) has accurate
          // bounds, instead of only measuring bounds without ever expanding to them.
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'creative-artistic') {
          applyCreativeArtisticPdfLayout(cloneRoot);
          normalizeCreativeArtisticPdfTextStyles(cloneRoot);
          applyCreativeArtisticPdfNoWrapItems(cloneRoot);
          // Pagination already ran on the live source root before html2canvas capture,
          // and copyTemplateComputedStyles above copied the resulting margin-top shifts
          // onto the clone. Re-running keep-together inside onclone was unreliable on
          // Android WebView because getBoundingClientRect() on the detached clone often
          // returns stale/zero geometry, which could skip tail balancing or apply a
          // conflicting Education-only shift. Measure semantic bounds from the clone as
          // rendered with the copied shifts instead.
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'elegant-formal') {
          applyElegantFormalPdfLayout(cloneRoot);
          normalizeElegantFormalPdfTextStyles(cloneRoot);
          applyElegantFormalPdfNoWrapItems(cloneRoot);
          // Pagination already ran on the live source root before html2canvas capture,
          // and copyTemplateComputedStyles above copied the resulting margin-top shifts
          // onto the clone. Re-running keep-together inside onclone was unreliable on
          // Android WebView because getBoundingClientRect() on the detached clone often
          // returns stale/zero geometry, which could skip orphan-heading protection or
          // apply a conflicting second shift that clips trailing content.
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'ats-standard') {
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'executive-premium') {
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'nordic-clean') {
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'tech-sidebar') {
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'corporate-navy') {
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'contemporary-bold') {
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'modern-minimal') {
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'rirekisho') {
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'clean-simple') {
          // V12: Clean Simple's keep-together pagination already ran on the *source*
          // root (before cloning) and its resulting margin shifts are cloned verbatim,
          // so no layout pass needs to be replayed here. What was missing is measuring
          // real semantic content bounds at all — every other multipage template does
          // this so its page-plan can never treat a page holding genuine tail content
          // (e.g. Skills/Languages) as trimmable, and so the pre-slice canvas crop below
          // can never cut the canvas shorter than the true last meaningful element.
          // Clean Simple skipped this entirely, which combined with Skills/Languages
          // chips having no `data-export-meaningful` marker (now fixed in
          // clean-simple-pdf-template.ts) let the canvas-pixel-only crop/trim heuristics
          // silently truncate those sections on real Android captures.
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        cloneRoot.removeAttribute('data-export-capture-id');
        removeCloneStylesheets(clonedDocument);
      },
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
    taggedCaptureTarget?.removeAttribute('data-export-capture-id');
    restoreInlineStyles(sourceStyleSnapshots);
    restorePreparedExportImages(preparedImages);
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

  let pdfCanvas = canvas;
  const shouldTrimBlankPdfSlices = captureTemplateId === 'clean-simple' || captureTemplateId === 'professional-classic' || captureTemplateId === 'creative-bold' || captureTemplateId === 'creative-artistic' || captureTemplateId === 'elegant-formal' || captureTemplateId === 'ats-standard' || captureTemplateId === 'executive-premium' || captureTemplateId === 'nordic-clean' || captureTemplateId === 'tech-sidebar' || captureTemplateId === 'corporate-navy' || captureTemplateId === 'contemporary-bold' || captureTemplateId === 'modern-minimal' || captureTemplateId === 'rirekisho';
  const shouldUseFullSemanticCanvas = (captureTemplateId === 'creative-artistic' || captureTemplateId === 'elegant-formal' || captureTemplateId === 'ats-standard' || captureTemplateId === 'executive-premium' || captureTemplateId === 'nordic-clean' || captureTemplateId === 'tech-sidebar' || captureTemplateId === 'corporate-navy' || captureTemplateId === 'contemporary-bold' || captureTemplateId === 'rirekisho' || captureTemplateId === 'professional-classic' || captureTemplateId === 'clean-simple') && Boolean(semanticMeaningfulBounds);
  if (shouldTrimBlankPdfSlices && !shouldUseFullSemanticCanvas) {
    const semanticCanvasBottom = getSemanticCanvasBottom(semanticMeaningfulBounds, canvas.width, captureWidth);
    const visibleBottom = Math.min(
      canvas.height,
      Math.max(findVisibleCanvasBottom(canvas), semanticCanvasBottom ?? 0),
    );
    if (visibleBottom > 0 && visibleBottom < canvas.height) {
      const croppedCanvas = document.createElement('canvas');
      croppedCanvas.width = canvas.width;
      croppedCanvas.height = visibleBottom;
      const croppedCtx = croppedCanvas.getContext('2d');
      if (croppedCtx) {
        croppedCtx.drawImage(canvas, 0, 0, canvas.width, visibleBottom, 0, 0, canvas.width, visibleBottom);
        pdfCanvas = croppedCanvas;
      }
    }
  }

  const imgData = pdfCanvas.toDataURL('image/jpeg', 0.95);
  const canvasWidthPx = pdfCanvas.width;
  const canvasHeightPx = pdfCanvas.height;
  const semanticPagePlan = semanticMeaningfulBounds
    ? createMeaningfulContentPagePlan(semanticMeaningfulBounds, canvasWidthPx, captureWidth)
    : null;

  const contentHeightMM = (canvasHeightPx / canvasWidthPx) * CV_PDF_A4_WIDTH_MM;
  const useSinglePageTolerance = semanticPagePlan ? 0 : PDF_TRAILING_SLICE_TOLERANCE_MM;
  const useSinglePage = contentHeightMM <= CV_PDF_A4_HEIGHT_MM + useSinglePageTolerance;

  // ── Step 6: build PDF ─────────────────────────────────────────────────────
  try {
    const pdf = new jsPDFCtor({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    if (useSinglePage) {
      pdf.addImage(imgData, 'JPEG', 0, 0, CV_PDF_A4_WIDTH_MM, Math.min(contentHeightMM, CV_PDF_A4_HEIGHT_MM));
    } else {
      const pageHeightPx = (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM) * canvasWidthPx;
      const trailingTolerancePx = (PDF_TRAILING_SLICE_TOLERANCE_MM / CV_PDF_A4_WIDTH_MM) * canvasWidthPx;
      const cssToCanvasScale = captureWidth > 0 ? canvasWidthPx / captureWidth : scale;
      const activeCaptureTemplateId = forcedCaptureTemplateId ?? captureTemplateId;
      const continuationSliceInsets = explicitContinuationSliceInsets
        ?? (activeCaptureTemplateId === 'clean-simple'
          ? {
              topInsetCssPx: CLEAN_SIMPLE_PDF_PAGE_TOP_INSET_CSS_PX,
              bottomInsetCssPx: CLEAN_SIMPLE_PDF_PAGE_BOTTOM_INSET_CSS_PX,
            }
          : null);
      const elegantFormalLineIntervalsCanvas = (
        elegantFormalTextLineIntervalsCss
        && elegantFormalTextLineIntervalsCss.length > 0
      )
        ? scaleElegantFormalTextLineIntervalsToCanvas(elegantFormalTextLineIntervalsCss, cssToCanvasScale)
        : null;
      const elegantFormalDomIntervalsReliable = elegantFormalTextLineIntervalsCss
        ? areElegantFormalDomLineIntervalsReliable(elegantFormalTextLineIntervalsCss)
        : false;
      const elegantFormalGuardCanvasPx = ELEGANT_FORMAL_PAGE_BREAK_GUARD_PX * cssToCanvasScale;
      const elegantFormalDomSearchCanvasPx = ELEGANT_FORMAL_PAGE_BREAK_SEARCH_RANGE_PX * cssToCanvasScale;
      const elegantFormalCanvasSearchCanvasPx = ELEGANT_FORMAL_CANVAS_PAGE_BREAK_SEARCH_RANGE_PX * cssToCanvasScale;
      const elegantFormalTopInsetCanvasPx = captureTemplateId === 'elegant-formal'
        ? Math.round(ELEGANT_FORMAL_PDF_PAGE_TOP_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const elegantFormalBottomInsetCanvasPx = captureTemplateId === 'elegant-formal'
        ? Math.round(ELEGANT_FORMAL_PDF_PAGE_BOTTOM_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const atsStandardTopInsetCanvasPx = captureTemplateId === 'ats-standard'
        ? Math.round(ATS_STANDARD_PDF_PAGE_TOP_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const atsStandardBottomInsetCanvasPx = captureTemplateId === 'ats-standard'
        ? Math.round(ATS_STANDARD_PDF_PAGE_BOTTOM_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const executivePremiumTopInsetCanvasPx = captureTemplateId === 'executive-premium'
        ? Math.round(EXECUTIVE_PREMIUM_PDF_PAGE_TOP_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const executivePremiumBottomInsetCanvasPx = captureTemplateId === 'executive-premium'
        ? Math.round(EXECUTIVE_PREMIUM_PDF_PAGE_BOTTOM_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const nordicCleanTopInsetCanvasPx = captureTemplateId === 'nordic-clean'
        ? Math.round(NORDIC_CLEAN_PDF_PAGE_TOP_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const nordicCleanBottomInsetCanvasPx = captureTemplateId === 'nordic-clean'
        ? Math.round(NORDIC_CLEAN_PDF_PAGE_BOTTOM_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const techSidebarTopInsetCanvasPx = captureTemplateId === 'tech-sidebar'
        ? Math.round(TECH_SIDEBAR_PDF_PAGE_TOP_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const techSidebarBottomInsetCanvasPx = captureTemplateId === 'tech-sidebar'
        ? Math.round(TECH_SIDEBAR_PDF_PAGE_BOTTOM_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const modernMinimalTopInsetCanvasPx = captureTemplateId === 'modern-minimal'
        ? Math.round(MODERN_MINIMAL_PDF_PAGE_TOP_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const modernMinimalBottomInsetCanvasPx = captureTemplateId === 'modern-minimal'
        ? Math.round(MODERN_MINIMAL_PDF_PAGE_BOTTOM_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const creativeBoldTopInsetCanvasPx = captureTemplateId === 'creative-bold'
        ? Math.round(CREATIVE_BOLD_PDF_PAGE_TOP_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const creativeBoldBottomInsetCanvasPx = captureTemplateId === 'creative-bold'
        ? Math.round(CREATIVE_BOLD_PDF_PAGE_BOTTOM_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const creativeBoldBreakSearchCanvasPx = CREATIVE_BOLD_PDF_PAGE_BREAK_SEARCH_RANGE_CSS_PX * cssToCanvasScale;
      const creativeBoldMinWhitespaceBandCanvasPx = Math.max(
        8,
        Math.round(CREATIVE_BOLD_PDF_PAGE_BREAK_MIN_BAND_CSS_PX * cssToCanvasScale),
      );
      const creativeArtisticTopInsetCanvasPx = captureTemplateId === 'creative-artistic'
        ? Math.round(CREATIVE_ARTISTIC_PDF_PAGE_TOP_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const creativeArtisticBottomInsetCanvasPx = captureTemplateId === 'creative-artistic'
        ? Math.round(CREATIVE_ARTISTIC_PDF_PAGE_BOTTOM_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const creativeArtisticBreakSearchCanvasPx = CREATIVE_ARTISTIC_PDF_PAGE_BREAK_SEARCH_RANGE_CSS_PX * cssToCanvasScale;
      const creativeArtisticMinWhitespaceBandCanvasPx = Math.max(
        8,
        Math.round(CREATIVE_ARTISTIC_PDF_PAGE_BREAK_MIN_BAND_CSS_PX * cssToCanvasScale),
      );
      const rirekishoTopInsetCanvasPx = captureTemplateId === 'rirekisho'
        ? Math.round(RIREKISHO_PDF_PAGE_TOP_INSET_CSS_PX * cssToCanvasScale)
        : 0;
      const rirekishoBottomInsetCanvasPx = captureTemplateId === 'rirekisho'
        ? Math.round(RIREKISHO_PDF_PAGE_BOTTOM_INSET_CSS_PX * cssToCanvasScale)
        : 0;

      const renderPdfSlice = (
        offsetY: number,
        sliceHeight: number,
        pdfPageIndex: number,
      ): void => {
        if (pdfPageIndex > 0) pdf.addPage();

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvasWidthPx;
        sliceCanvas.height = sliceHeight;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(pdfCanvas, 0, offsetY, canvasWidthPx, sliceHeight, 0, 0, canvasWidthPx, sliceHeight);
        }
        const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightMM = (sliceHeight / canvasWidthPx) * CV_PDF_A4_WIDTH_MM;
        pdf.addImage(
          sliceImg,
          'JPEG',
          0,
          0,
          CV_PDF_A4_WIDTH_MM,
          Math.min(sliceHeightMM, CV_PDF_A4_HEIGHT_MM),
        );
      };

      const renderPaddedPdfSlice = (
        offsetY: number,
        sliceHeight: number,
        pdfPageIndex: number,
        isFinalPage: boolean,
        topInsetCanvasPx: number,
        bottomInsetCanvasPx: number,
      ): void => {
        if (pdfPageIndex > 0) pdf.addPage();

        const topPadCanvasPx = pdfPageIndex > 0 ? topInsetCanvasPx : 0;
        const bottomPadCanvasPx = isFinalPage ? 0 : bottomInsetCanvasPx;
        const maxContentHeightPx = topPadCanvasPx > 0
          ? Math.max(1, pageHeightPx - topPadCanvasPx)
          : sliceHeight;
        const safeSliceHeight = topPadCanvasPx > 0
          ? Math.min(sliceHeight, maxContentHeightPx)
          : sliceHeight;
        const paddedSlice = buildPaddedPdfSlice(
          pdfCanvas,
          offsetY,
          safeSliceHeight,
          canvasWidthPx,
          topPadCanvasPx,
          bottomPadCanvasPx,
        );
        const paddedHeightMM = (paddedSlice.paddedHeightPx / canvasWidthPx) * CV_PDF_A4_WIDTH_MM;
        pdf.addImage(
          paddedSlice.dataUrl,
          'JPEG',
          0,
          0,
          CV_PDF_A4_WIDTH_MM,
          Math.min(paddedHeightMM, CV_PDF_A4_HEIGHT_MM),
        );
      };

      const renderElegantFormalPdfSlice = (
        offsetY: number,
        sliceHeight: number,
        pdfPageIndex: number,
        isFinalPage: boolean,
      ): void => {
        renderPaddedPdfSlice(
          offsetY,
          sliceHeight,
          pdfPageIndex,
          isFinalPage,
          elegantFormalTopInsetCanvasPx,
          elegantFormalBottomInsetCanvasPx,
        );
      };

      if (captureTemplateId === 'elegant-formal') {
        const segments = planElegantFormalPdfSliceSegments(
          canvasHeightPx,
          pageHeightPx,
          trailingTolerancePx,
          pdfCanvas,
          elegantFormalLineIntervalsCanvas,
          elegantFormalDomIntervalsReliable,
          elegantFormalGuardCanvasPx,
          elegantFormalDomSearchCanvasPx,
          elegantFormalCanvasSearchCanvasPx,
          elegantFormalPageBreakSources,
        );

        let renderedPageIndex = 0;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
          const segment = segments[segmentIndex];
          const offsetY = segment.startPx;
          const sliceHeight = segment.endPx - segment.startPx;
          if (semanticPagePlan && segmentIndex > 0) {
            const pageBottomPx = offsetY + sliceHeight;
            if (!pageHasMeaningfulContent(semanticPagePlan, offsetY, pageBottomPx)) {
              if (!hasFutureMeaningfulContent(semanticPagePlan, pageBottomPx)) break;
              continue;
            }
          }
          if (
            shouldTrimBlankPdfSlices
            && !semanticPagePlan
            && segmentIndex > 0
            && isTemplateCanvasSliceEffectivelyBlank(pdfCanvas, offsetY, sliceHeight, captureTemplateId)
          ) {
            break;
          }
          renderElegantFormalPdfSlice(
            offsetY,
            sliceHeight,
            renderedPageIndex,
            segmentIndex === segments.length - 1,
          );
          renderedPageIndex += 1;
        }
      } else if (captureTemplateId === 'tech-sidebar') {
        const techSidebarDomLineIntervalsCanvas = (
          techSidebarTextLineIntervalsCss
          && techSidebarTextLineIntervalsCss.length > 0
        )
          ? scaleElegantFormalTextLineIntervalsToCanvas(techSidebarTextLineIntervalsCss, cssToCanvasScale)
          : null;
        const techSidebarDomIntervalsReliable = techSidebarTextLineIntervalsCss
          ? areElegantFormalDomLineIntervalsReliable(techSidebarTextLineIntervalsCss)
          : false;
        const techSidebarMainColumnBoundsCanvas = scaleTechSidebarMainColumnBoundsToCanvas(
          techSidebarMainColumnBoundsCss ?? getTechSidebarMainColumnContentBoundsCss(
            taggedCaptureTarget ?? (firstChild ?? element),
          ),
          canvasWidthPx,
          captureWidth,
        );
        const techSidebarCanvasInkLineIntervals = extractTechSidebarMainColumnInkLineIntervalsFromCanvas(
          pdfCanvas,
          techSidebarMainColumnBoundsCanvas.contentLeftPx,
          techSidebarMainColumnBoundsCanvas.contentRightPx,
        );
        const techSidebarIntervalSelection = selectTechSidebarPdfLineIntervalsCanvas(
          techSidebarDomLineIntervalsCanvas,
          techSidebarDomIntervalsReliable,
          techSidebarCanvasInkLineIntervals,
        );
        const techSidebarGuardCanvasPx = TECH_SIDEBAR_PAGE_BREAK_GUARD_PX * cssToCanvasScale;
        const techSidebarDomSearchCanvasPx = TECH_SIDEBAR_PAGE_BREAK_SEARCH_RANGE_PX * cssToCanvasScale;
        const techSidebarCanvasSearchCanvasPx = TECH_SIDEBAR_CANVAS_PAGE_BREAK_SEARCH_RANGE_PX * cssToCanvasScale;
        const segments = planTechSidebarPdfSliceSegments(
          canvasHeightPx,
          pageHeightPx,
          trailingTolerancePx,
          pdfCanvas,
          techSidebarIntervalSelection.intervals,
          techSidebarIntervalSelection.reliable,
          techSidebarGuardCanvasPx,
          techSidebarDomSearchCanvasPx,
          techSidebarCanvasSearchCanvasPx,
          techSidebarMainColumnBoundsCanvas.contentLeftPx,
          techSidebarMainColumnBoundsCanvas.contentRightPx,
          techSidebarPageBreakSources,
        );

        let renderedPageIndex = 0;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
          const segment = segments[segmentIndex];
          const offsetY = segment.startPx;
          const sliceHeight = segment.endPx - segment.startPx;
          if (semanticPagePlan && segmentIndex > 0) {
            const pageBottomPx = offsetY + sliceHeight;
            if (!pageHasMeaningfulContent(semanticPagePlan, offsetY, pageBottomPx)) {
              if (!hasFutureMeaningfulContent(semanticPagePlan, pageBottomPx)) break;
              continue;
            }
          }
          if (
            shouldTrimBlankPdfSlices
            && !semanticPagePlan
            && segmentIndex > 0
            && isTemplateCanvasSliceEffectivelyBlank(pdfCanvas, offsetY, sliceHeight, captureTemplateId)
          ) {
            break;
          }
          renderPaddedPdfSlice(
            offsetY,
            sliceHeight,
            renderedPageIndex,
            segmentIndex === segments.length - 1,
            techSidebarTopInsetCanvasPx,
            techSidebarBottomInsetCanvasPx,
          );
          renderedPageIndex += 1;
        }
      } else if (captureTemplateId === 'rirekisho') {
        const rirekishoDomLineIntervalsCanvas = (
          rirekishoTextLineIntervalsCss
          && rirekishoTextLineIntervalsCss.length > 0
        )
          ? scaleElegantFormalTextLineIntervalsToCanvas(rirekishoTextLineIntervalsCss, cssToCanvasScale)
          : null;
        const rirekishoDomIntervalsReliable = rirekishoTextLineIntervalsCss
          ? areElegantFormalDomLineIntervalsReliable(rirekishoTextLineIntervalsCss)
          : false;
        const rirekishoContentBoundsCanvas = scaleRirekishoContentBoundsToCanvas(
          rirekishoContentBoundsCss ?? getRirekishoPdfContentBoundsCss(
            taggedCaptureTarget ?? (firstChild ?? element),
          ),
          canvasWidthPx,
          captureWidth,
        );
        const rirekishoCanvasInkLineIntervals = extractRirekishoInkLineIntervalsFromCanvas(
          pdfCanvas,
          rirekishoContentBoundsCanvas.contentLeftPx,
          rirekishoContentBoundsCanvas.contentRightPx,
        );
        const rirekishoIntervalSelection = selectRirekishoPdfLineIntervalsCanvas(
          rirekishoDomLineIntervalsCanvas,
          rirekishoDomIntervalsReliable,
          rirekishoCanvasInkLineIntervals,
        );
        const rirekishoGuardCanvasPx = RIREKISHO_PAGE_BREAK_GUARD_PX * cssToCanvasScale;
        const rirekishoDomSearchCanvasPx = RIREKISHO_PAGE_BREAK_SEARCH_RANGE_PX * cssToCanvasScale;
        const rirekishoCanvasSearchCanvasPx = RIREKISHO_CANVAS_PAGE_BREAK_SEARCH_RANGE_PX * cssToCanvasScale;
        const segments = planRirekishoPdfSliceSegments(
          canvasHeightPx,
          pageHeightPx,
          trailingTolerancePx,
          pdfCanvas,
          rirekishoIntervalSelection.intervals,
          rirekishoIntervalSelection.reliable,
          rirekishoGuardCanvasPx,
          rirekishoDomSearchCanvasPx,
          rirekishoCanvasSearchCanvasPx,
          rirekishoContentBoundsCanvas.contentLeftPx,
          rirekishoContentBoundsCanvas.contentRightPx,
          rirekishoPageBreakSources,
        );

        let renderedPageIndex = 0;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
          const segment = segments[segmentIndex];
          const offsetY = segment.startPx;
          const sliceHeight = segment.endPx - segment.startPx;
          if (semanticPagePlan && segmentIndex > 0) {
            const pageBottomPx = offsetY + sliceHeight;
            if (!pageHasMeaningfulContent(semanticPagePlan, offsetY, pageBottomPx)) {
              if (!hasFutureMeaningfulContent(semanticPagePlan, pageBottomPx)) break;
              continue;
            }
          }
          if (
            shouldTrimBlankPdfSlices
            && !semanticPagePlan
            && segmentIndex > 0
            && isTemplateCanvasSliceEffectivelyBlank(pdfCanvas, offsetY, sliceHeight, captureTemplateId)
          ) {
            break;
          }
          renderPaddedPdfSlice(
            offsetY,
            sliceHeight,
            renderedPageIndex,
            segmentIndex === segments.length - 1,
            rirekishoTopInsetCanvasPx,
            rirekishoBottomInsetCanvasPx,
          );
          renderedPageIndex += 1;
        }
      } else if (continuationSliceInsets) {
        const topInsetCanvasPx = Math.round(continuationSliceInsets.topInsetCssPx * cssToCanvasScale);
        const bottomInsetCanvasPx = Math.round(continuationSliceInsets.bottomInsetCssPx * cssToCanvasScale);
        const contentBounds = getCleanSimplePdfContentBoundsCanvas(canvasWidthPx, captureWidth, cssToCanvasScale);
        const guardCanvasPx = CLEAN_SIMPLE_PAGE_BREAK_GUARD_PX * cssToCanvasScale;
        const canvasSearchCanvasPx = CLEAN_SIMPLE_CANVAS_PAGE_BREAK_SEARCH_RANGE_PX * cssToCanvasScale;
        const cleanSimpleLineIntervalsCanvas = (
          cleanSimpleTextLineIntervalsCss && cleanSimpleTextLineIntervalsCss.length > 0
        )
          ? scaleElegantFormalTextLineIntervalsToCanvas(cleanSimpleTextLineIntervalsCss, cssToCanvasScale)
          : null;
        const cleanSimpleDomIntervalsReliable = cleanSimpleTextLineIntervalsCss
          ? areElegantFormalDomLineIntervalsReliable(cleanSimpleTextLineIntervalsCss)
          : false;
        const cleanSimpleDomSearchCanvasPx = CLEAN_SIMPLE_DOM_PAGE_BREAK_SEARCH_RANGE_PX * cssToCanvasScale;
        const cleanSimpleSentenceSpansCanvas = (
          cleanSimpleSummarySentenceSpansCss && cleanSimpleSummarySentenceSpansCss.length > 0
        )
          ? scaleElegantFormalTextLineIntervalsToCanvas(cleanSimpleSummarySentenceSpansCss, cssToCanvasScale)
          : null;
        const postLineGuardCanvasPx = CLEAN_SIMPLE_POST_LINE_BREAK_GUARD_CSS_PX * cssToCanvasScale;
        const cleanSimpleSliceBreakDiagnostics: CleanSimplePdfSliceBreakDiagnostics[] = [];
        const segments = planCleanSimplePdfSliceSegments(
          canvasHeightPx,
          pageHeightPx,
          trailingTolerancePx,
          pdfCanvas,
          contentBounds.contentLeftPx,
          contentBounds.contentRightPx,
          guardCanvasPx,
          canvasSearchCanvasPx,
          topInsetCanvasPx,
          bottomInsetCanvasPx,
          cleanSimpleLineIntervalsCanvas,
          cleanSimpleDomIntervalsReliable,
          cleanSimpleDomSearchCanvasPx,
          cleanSimpleSentenceSpansCanvas,
          postLineGuardCanvasPx,
          cleanSimpleSliceBreakDiagnostics,
        );
        if (typeof window !== 'undefined') {
          (window as typeof window & {
            __cleanSimplePdfPaginationReport?: {
              segments: CleanSimplePdfSliceSegment[];
              breakDiagnostics: CleanSimplePdfSliceBreakDiagnostics[];
              topInsetCanvasPx: number;
              bottomInsetCanvasPx: number;
              postLineGuardCanvasPx: number;
            };
          }).__cleanSimplePdfPaginationReport = {
            segments,
            breakDiagnostics: cleanSimpleSliceBreakDiagnostics,
            topInsetCanvasPx,
            bottomInsetCanvasPx,
            postLineGuardCanvasPx,
          };
        }

        let renderedPageIndex = 0;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
          const segment = segments[segmentIndex];
          const offsetY = segment.startPx;
          const sliceHeight = segment.endPx - segment.startPx;
          const isFinalPage = segmentIndex === segments.length - 1;
          if (semanticPagePlan && renderedPageIndex > 0) {
            const pageBottomPx = offsetY + sliceHeight;
            if (!pageHasMeaningfulContent(semanticPagePlan, offsetY, pageBottomPx)) {
              if (!hasFutureMeaningfulContent(semanticPagePlan, pageBottomPx)) break;
              continue;
            }
          }
          if (
            shouldTrimBlankPdfSlices
            && !semanticPagePlan
            && renderedPageIndex > 0
            && isTemplateCanvasSliceEffectivelyBlank(pdfCanvas, offsetY, sliceHeight, activeCaptureTemplateId)
          ) {
            break;
          }
          renderPaddedPdfSlice(
            offsetY,
            sliceHeight,
            renderedPageIndex,
            isFinalPage,
            topInsetCanvasPx,
            bottomInsetCanvasPx,
          );
          renderedPageIndex += 1;
        }
      } else if (captureTemplateId === 'creative-artistic') {
        const segments = planCreativeArtisticPdfSliceSegments(
          canvasHeightPx,
          pageHeightPx,
          trailingTolerancePx,
          pdfCanvas,
          creativeArtisticTopInsetCanvasPx,
          creativeArtisticBottomInsetCanvasPx,
          creativeArtisticBreakSearchCanvasPx,
          creativeArtisticMinWhitespaceBandCanvasPx,
          cssToCanvasScale,
        );

        let renderedPageIndex = 0;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
          const segment = segments[segmentIndex];
          const offsetY = segment.startPx;
          const sliceHeight = segment.endPx - segment.startPx;
          const isFinalPage = segmentIndex === segments.length - 1;
          if (semanticPagePlan && renderedPageIndex > 0) {
            const pageBottomPx = offsetY + sliceHeight;
            if (!pageHasMeaningfulContent(semanticPagePlan, offsetY, pageBottomPx)) {
              if (!hasFutureMeaningfulContent(semanticPagePlan, pageBottomPx)) break;
              continue;
            }
          }
          if (
            shouldTrimBlankPdfSlices
            && !semanticPagePlan
            && renderedPageIndex > 0
            && isTemplateCanvasSliceEffectivelyBlank(pdfCanvas, offsetY, sliceHeight, captureTemplateId)
          ) {
            break;
          }
          renderPaddedPdfSlice(
            offsetY,
            sliceHeight,
            renderedPageIndex,
            isFinalPage,
            creativeArtisticTopInsetCanvasPx,
            creativeArtisticBottomInsetCanvasPx,
          );
          renderedPageIndex += 1;
        }
      } else if (captureTemplateId === 'creative-bold') {
        const segments = planCreativeBoldPdfSliceSegments(
          canvasHeightPx,
          pageHeightPx,
          trailingTolerancePx,
          pdfCanvas,
          creativeBoldTopInsetCanvasPx,
          creativeBoldBottomInsetCanvasPx,
          creativeBoldBreakSearchCanvasPx,
          creativeBoldMinWhitespaceBandCanvasPx,
          cssToCanvasScale,
        );

        let renderedPageIndex = 0;
        for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
          const segment = segments[segmentIndex];
          const offsetY = segment.startPx;
          const sliceHeight = segment.endPx - segment.startPx;
          const isFinalPage = segmentIndex === segments.length - 1;
          if (semanticPagePlan && renderedPageIndex > 0) {
            const pageBottomPx = offsetY + sliceHeight;
            if (!pageHasMeaningfulContent(semanticPagePlan, offsetY, pageBottomPx)) {
              if (!hasFutureMeaningfulContent(semanticPagePlan, pageBottomPx)) break;
              continue;
            }
          }
          if (
            shouldTrimBlankPdfSlices
            && !semanticPagePlan
            && renderedPageIndex > 0
            && isTemplateCanvasSliceEffectivelyBlank(pdfCanvas, offsetY, sliceHeight, captureTemplateId)
          ) {
            break;
          }
          renderPaddedPdfSlice(
            offsetY,
            sliceHeight,
            renderedPageIndex,
            isFinalPage,
            creativeBoldTopInsetCanvasPx,
            creativeBoldBottomInsetCanvasPx,
          );
          renderedPageIndex += 1;
        }
      } else {
        let offsetY = 0;
        let renderedPageIndex = 0;

        while (offsetY < canvasHeightPx - trailingTolerancePx) {
          const sliceHeight = Math.min(pageHeightPx, canvasHeightPx - offsetY);
          const isFinalPage = offsetY + sliceHeight >= canvasHeightPx - trailingTolerancePx - PDF_PAGE_INTERSECTION_EPSILON_PX;
          if (semanticPagePlan && renderedPageIndex > 0) {
            const pageBottomPx = offsetY + sliceHeight;
            if (!pageHasMeaningfulContent(semanticPagePlan, offsetY, pageBottomPx)) {
              if (!hasFutureMeaningfulContent(semanticPagePlan, pageBottomPx)) break;
              offsetY += pageHeightPx;
              continue;
            }
          }
          if (
            shouldTrimBlankPdfSlices
            && !semanticPagePlan
            && renderedPageIndex > 0
            && isTemplateCanvasSliceEffectivelyBlank(pdfCanvas, offsetY, sliceHeight, captureTemplateId)
          ) {
            break;
          }
          if (captureTemplateId === 'ats-standard') {
            renderPaddedPdfSlice(
              offsetY,
              sliceHeight,
              renderedPageIndex,
              isFinalPage,
              atsStandardTopInsetCanvasPx,
              atsStandardBottomInsetCanvasPx,
            );
          } else if (captureTemplateId === 'executive-premium') {
            renderPaddedPdfSlice(
              offsetY,
              sliceHeight,
              renderedPageIndex,
              isFinalPage,
              executivePremiumTopInsetCanvasPx,
              executivePremiumBottomInsetCanvasPx,
            );
          } else if (captureTemplateId === 'nordic-clean') {
            renderPaddedPdfSlice(
              offsetY,
              sliceHeight,
              renderedPageIndex,
              isFinalPage,
              nordicCleanTopInsetCanvasPx,
              nordicCleanBottomInsetCanvasPx,
            );
          } else if (captureTemplateId === 'modern-minimal') {
            renderPaddedPdfSlice(
              offsetY,
              sliceHeight,
              renderedPageIndex,
              isFinalPage,
              modernMinimalTopInsetCanvasPx,
              modernMinimalBottomInsetCanvasPx,
            );
          } else {
            renderPdfSlice(offsetY, sliceHeight, renderedPageIndex);
          }
          renderedPageIndex += 1;
          offsetY += sliceHeight;
        }
      }
    }

    if (pdfBuildCanary) {
      pdf.setProperties({
        keywords: pdfBuildCanary,
        subject: pdfBuildCanary,
      });
    }

    // Unified flow: create a PDF Blob first, then hand it to the platform save
    // boundary. Android API 29+ saves through MediaStore in saveFileViaPlatform.
    const pdfBlob = pdfToBlob(pdf);
    if (!pdfBlob || pdfBlob.size === 0) {
      throw new Error('PDF generation produced an empty or invalid Blob');
    }
    if (captureTemplateId === 'elegant-formal' && taggedCaptureTarget) {
      taggedCaptureTarget.setAttribute(
        'data-ef-pdf-break-sources',
        elegantFormalPageBreakSources.join(',') || 'none',
      );
      taggedCaptureTarget.setAttribute(
        'data-ef-pdf-safe-slice',
        elegantFormalPageBreakSources.some(source => source === 'canvas' || source === 'dom') ? 'true' : 'false',
      );
    }
    if (captureTemplateId === 'tech-sidebar' && taggedCaptureTarget) {
      taggedCaptureTarget.setAttribute(
        'data-ts-pdf-break-sources',
        techSidebarPageBreakSources.join(',') || 'none',
      );
      taggedCaptureTarget.setAttribute(
        'data-ts-pdf-safe-slice',
        techSidebarPageBreakSources.some(source => source === 'canvas' || source === 'dom') ? 'true' : 'false',
      );
    }
    return pdfBlob;
  } catch (pdfErr) {
    console.error('[exportToPDF] jsPDF generation failed:', pdfErr);
    throw pdfErr;
  }
}

export async function exportToPDF(elementId: string, fileName: string): Promise<SaveFileResult> {
  const pdfBlob = await buildCvPdfBlob(elementId);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

// Canonical square + circular crop for the Modern Minimal PDF header photo.
// Used only as a fallback when cv.personal.photo (the user's own framed crop) is
// unavailable and we must derive a square crop from the raw originalPhoto instead.
// Uses a gentler top bias than the DOCX helper (0.32 vs 0.20) so a raw, un-framed
// portrait photo keeps the chin/neck visible instead of cropping tight under the eyes.
function cropModernMinimalPdfPhoto(dataUrl: string, outputSize: number): Promise<string> {
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
      const sy = isPortrait ? -(scaledH - outputSize) * 0.32 : (outputSize - scaledH) / 2;
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, scaledW, scaledH);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function prepareModernMinimalPdfPhotoDataUrl(cv: CVData): Promise<string | null> {
  const showPhoto = cv.personal.photoEnabled !== undefined
    ? cv.personal.photoEnabled
    : cv.region !== 'US';
  if (!showPhoto) return null;

  const personalPhotos = cv.personal as CVData['personal'] & {
    originalPhoto?: string;
  };
  // Prefer cv.personal.photo — the circular crop the user already framed themselves
  // in the in-app photo cropper (zoom/offset). This is the SAME source the Modern
  // Minimal DOCX export embeds, so the PDF face framing matches DOCX exactly instead
  // of re-guessing a generic crop on the raw, un-framed originalPhoto (which may be
  // any aspect ratio/composition and was the actual cause of "cropped too high/chin
  // missing" — a blind square crop cannot know where the user's face actually is in
  // the untouched original). originalPhoto is only used as a fallback for the rare
  // case a selected photo is missing.
  const source = cv.personal.photo?.trim() || personalPhotos.originalPhoto?.trim();
  if (!source) return null;

  const prepared = await prepareCvPhotoForExport(source);
  if (!prepared?.dataUrl) return null;
  const decoded = await decodeImageForExport(prepared.dataUrl);
  if (!decoded) return null;

  try {
    return await cropModernMinimalPdfPhoto(prepared.dataUrl, 512);
  } catch {
    return prepared.dataUrl;
  }
}

export async function buildModernMinimalPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Modern Minimal PDF export requires a browser DOM');
  }

  const photoDataUrl = await prepareModernMinimalPdfPhotoDataUrl(cv);
  const container = document.createElement('div');
  container.id = `modern-minimal-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-modern-minimal-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createModernMinimalPdfTemplate(cv, {
    locale,
    photoDataUrl,
  }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('Modern Minimal PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
}

export async function exportModernMinimalPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildModernMinimalPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

// Canonical square + circular crop for the Clean Simple PDF header photo.
// Used only as a fallback when cv.personal.photo (the user's own framed crop) is
// unavailable and we must derive a square crop from the raw originalPhoto instead.
function cropCleanSimplePdfPhoto(dataUrl: string, outputSize: number): Promise<string> {
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
      const sy = isPortrait ? -(scaledH - outputSize) * 0.32 : (outputSize - scaledH) / 2;
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, scaledW, scaledH);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function prepareCleanSimplePdfPhotoDataUrl(cv: CVData): Promise<string | null> {
  const showPhoto = cv.personal.photoEnabled !== undefined
    ? cv.personal.photoEnabled
    : cv.region !== 'US';
  if (!showPhoto) return null;

  const personalPhotos = cv.personal as CVData['personal'] & {
    originalPhoto?: string;
  };
  // Prefer cv.personal.photo — the circular crop the user already framed themselves
  // in the in-app photo cropper — matching the Clean Simple DOCX export exactly.
  // originalPhoto is only used as a fallback for the rare case a selected photo is
  // missing.
  const source = cv.personal.photo?.trim() || personalPhotos.originalPhoto?.trim();
  if (!source) return null;

  const prepared = await prepareCvPhotoForExport(source);
  if (!prepared?.dataUrl) return null;
  const decoded = await decodeImageForExport(prepared.dataUrl);
  if (!decoded) return null;

  try {
    return await cropCleanSimplePdfPhoto(prepared.dataUrl, 512);
  } catch {
    return prepared.dataUrl;
  }
}

type CleanSimplePdfWriter = InstanceType<typeof import('jspdf').jsPDF>;

type CleanSimpleDirectPdfContext = {
  pdf: CleanSimplePdfWriter;
  locale: Locale;
  labels: ReturnType<typeof getCleanSimplePdfLabels>;
  pageWidth: number;
  pageHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  contentWidth: number;
  bottomSafeY: number;
  y: number;
};

type CleanSimpleTextStyle = {
  size: number;
  color: [number, number, number];
  fontStyle?: 'normal' | 'bold';
  lineHeight: number;
};

const CLEAN_SIMPLE_DIRECT_GREEN: [number, number, number] = [5, 150, 105];
const CLEAN_SIMPLE_DIRECT_TEXT: [number, number, number] = [17, 24, 39];
const CLEAN_SIMPLE_DIRECT_MUTED: [number, number, number] = [75, 85, 99];
const CLEAN_SIMPLE_DIRECT_LIGHT: [number, number, number] = [156, 163, 175];
const CLEAN_SIMPLE_DIRECT_RULE: [number, number, number] = [229, 231, 235];

function getCleanSimplePdfLabels(locale: Locale) {
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

function cleanSimpleDirectDateRange(start: string, end: string, present: boolean, presentLabel: string): string {
  return [start, present ? presentLabel : end].filter(Boolean).join(' - ');
}

function cleanSimpleSetTextStyle(ctx: CleanSimpleDirectPdfContext, style: CleanSimpleTextStyle): void {
  ctx.pdf.setFont('helvetica', style.fontStyle ?? 'normal');
  ctx.pdf.setFontSize(style.size);
  ctx.pdf.setTextColor(style.color[0], style.color[1], style.color[2]);
}

function cleanSimpleSplitText(ctx: CleanSimpleDirectPdfContext, text: string, maxWidth = ctx.contentWidth): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const result = ctx.pdf.splitTextToSize(normalized, maxWidth);
  return Array.isArray(result) ? result.map(String) : [String(result)];
}

function cleanSimpleStartPage(ctx: CleanSimpleDirectPdfContext): void {
  ctx.pdf.addPage();
  ctx.y = ctx.marginTop;
}

function cleanSimpleFreshPageCapacity(ctx: CleanSimpleDirectPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

function cleanSimpleEnsureSpace(ctx: CleanSimpleDirectPdfContext, heightNeeded: number): void {
  if (ctx.y + heightNeeded <= ctx.bottomSafeY) return;
  cleanSimpleStartPage(ctx);
}

function cleanSimpleMoveToFreshPageIfNeeded(ctx: CleanSimpleDirectPdfContext, blockHeight: number): void {
  const freshCapacity = cleanSimpleFreshPageCapacity(ctx);
  if (blockHeight > freshCapacity) return;
  if (ctx.y + blockHeight > ctx.bottomSafeY) {
    cleanSimpleStartPage(ctx);
  }
}

function cleanSimpleDrawLines(
  ctx: CleanSimpleDirectPdfContext,
  lines: string[],
  style: CleanSimpleTextStyle,
  options: { indentX?: number } = {},
): void {
  cleanSimpleSetTextStyle(ctx, style);
  const x = ctx.marginLeft + (options.indentX ?? 0);
  for (const line of lines) {
    cleanSimpleEnsureSpace(ctx, style.lineHeight);
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function cleanSimpleDrawLinesBlock(
  ctx: CleanSimpleDirectPdfContext,
  lines: string[],
  style: CleanSimpleTextStyle,
  options: { indentX?: number } = {},
): void {
  if (lines.length === 0) return;
  const blockHeight = lines.length * style.lineHeight;
  cleanSimpleMoveToFreshPageIfNeeded(ctx, blockHeight);
  cleanSimpleSetTextStyle(ctx, style);
  const x = ctx.marginLeft + (options.indentX ?? 0);
  for (const line of lines) {
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function cleanSimpleDrawAtomicSection(
  ctx: CleanSimpleDirectPdfContext,
  label: string,
  lines: string[],
  style: CleanSimpleTextStyle,
  options: { spacingAfter?: number; indentX?: number } = {},
): void {
  const spacingAfter = options.spacingAfter ?? 4;
  const blockHeight = cleanSimpleSectionHeadingHeight() + lines.length * style.lineHeight + spacingAfter;
  cleanSimpleMoveToFreshPageIfNeeded(ctx, blockHeight);
  cleanSimpleDrawSectionHeading(ctx, label);
  cleanSimpleDrawLinesBlock(ctx, lines, style, { indentX: options.indentX });
  ctx.y += spacingAfter;
}

function cleanSimpleSectionHeadingHeight(): number {
  return 7.2;
}

function cleanSimpleDrawSectionHeading(ctx: CleanSimpleDirectPdfContext, label: string): void {
  cleanSimpleEnsureSpace(ctx, cleanSimpleSectionHeadingHeight());
  cleanSimpleSetTextStyle(ctx, { size: 8.25, color: CLEAN_SIMPLE_DIRECT_GREEN, fontStyle: 'bold', lineHeight: 4.2 });
  ctx.pdf.text(label.toUpperCase(), ctx.marginLeft, ctx.y);
  ctx.y += cleanSimpleSectionHeadingHeight();
}

function cleanSimpleMeasureSectionWithLines(lines: string[], style: CleanSimpleTextStyle): number {
  return cleanSimpleSectionHeadingHeight() + lines.length * style.lineHeight + 4;
}

function cleanSimpleDrawHeader(ctx: CleanSimpleDirectPdfContext, cv: CVData, photoDataUrl: string | null): void {
  const headerTop = ctx.y;
  const photoSize = 22;
  if (photoDataUrl) {
    try {
      ctx.pdf.addImage(photoDataUrl, 'PNG', ctx.marginLeft, headerTop, photoSize, photoSize);
    } catch {
      try {
        ctx.pdf.addImage(photoDataUrl, 'JPEG', ctx.marginLeft, headerTop, photoSize, photoSize);
      } catch {
        // Keep PDF export usable if jsPDF rejects an image data URL.
      }
    }
  }

  const textX = photoDataUrl ? ctx.marginLeft + photoSize + 5 : ctx.marginLeft;
  cleanSimpleSetTextStyle(ctx, { size: 16.5, color: CLEAN_SIMPLE_DIRECT_TEXT, fontStyle: 'bold', lineHeight: 6 });
  ctx.pdf.text(cv.personal.fullName || 'Your Name', textX, headerTop + 5);
  if (cv.personal.jobTitle) {
    cleanSimpleSetTextStyle(ctx, { size: 9, color: CLEAN_SIMPLE_DIRECT_GREEN, lineHeight: 4 });
    ctx.pdf.text(cv.personal.jobTitle, textX, headerTop + 11);
  }
  const region = regionSettings[cv.region];
  const contacts = [cv.personal.email, cv.personal.phone, region.showAddress ? cv.personal.address : ''].filter(Boolean);
  if (contacts.length > 0) {
    cleanSimpleSetTextStyle(ctx, { size: 7.8, color: CLEAN_SIMPLE_DIRECT_MUTED, lineHeight: 4 });
    ctx.pdf.text(contacts.join('  |  '), textX, headerTop + 17);
  }
  ctx.y = headerTop + 28;
  ctx.pdf.setDrawColor(CLEAN_SIMPLE_DIRECT_RULE[0], CLEAN_SIMPLE_DIRECT_RULE[1], CLEAN_SIMPLE_DIRECT_RULE[2]);
  ctx.pdf.setLineWidth(0.3);
  ctx.pdf.line(ctx.marginLeft, ctx.y, ctx.pageWidth - ctx.marginRight, ctx.y);
  ctx.y += 8;
}

function cleanSimpleDrawSummary(ctx: CleanSimpleDirectPdfContext, summary: string): void {
  const blocks = splitCleanSimpleSummaryParagraphBlocks(summary);
  if (blocks.length === 0) return;
  const style: CleanSimpleTextStyle = { size: 8.1, color: CLEAN_SIMPLE_DIRECT_MUTED, lineHeight: 4.25 };
  cleanSimpleEnsureSpace(ctx, cleanSimpleSectionHeadingHeight());
  cleanSimpleDrawSectionHeading(ctx, ctx.labels.summary);
  blocks.forEach((block, index) => {
    cleanSimpleDrawLines(ctx, cleanSimpleSplitText(ctx, block), style);
    if (index < blocks.length - 1) ctx.y += 2.5;
  });
  ctx.y += 4.5;
}

function cleanSimpleExperienceLeadBlockHeight(ctx: CleanSimpleDirectPdfContext, entry: CVData['experience'][number]): number {
  const title = entry.company ? `${entry.position} at ${entry.company}` : entry.position;
  const titleLines = cleanSimpleSplitText(ctx, title, ctx.contentWidth - 35);
  const titleHeight = Math.max(4.8, titleLines.length * 4.3);
  const parts = entry.description.split(/\n+/).map(part => part.trim()).filter(Boolean);
  const bulletParts = parts.filter(part => /^[-•]\s*/.test(part));
  const leadParts = (bulletParts.length > 0 ? bulletParts : parts).slice(0, 2);
  const bulletHeight = leadParts.reduce((total, part) => {
    const lines = cleanSimpleSplitText(ctx, part.replace(/^[-•]\s*/, ''), ctx.contentWidth - 4);
    return total + lines.length * 4.05;
  }, 0);
  return titleHeight + bulletHeight + 4;
}

function cleanSimpleDrawExperienceEntry(ctx: CleanSimpleDirectPdfContext, entry: CVData['experience'][number]): void {
  const title = entry.company ? `${entry.position} at ${entry.company}` : entry.position;
  const titleLines = cleanSimpleSplitText(ctx, title, ctx.contentWidth - 35);
  cleanSimpleEnsureSpace(ctx, Math.max(4.8, titleLines.length * 4.3) + 8);
  cleanSimpleDrawLines(ctx, titleLines, { size: 8.1, color: CLEAN_SIMPLE_DIRECT_TEXT, fontStyle: 'bold', lineHeight: 4.3 });
  const dateText = cleanSimpleDirectDateRange(entry.startDate, entry.endDate, entry.isPresent, ctx.labels.present);
  if (dateText) {
    cleanSimpleSetTextStyle(ctx, { size: 7.1, color: CLEAN_SIMPLE_DIRECT_LIGHT, lineHeight: 3.5 });
    ctx.pdf.text(dateText, ctx.pageWidth - ctx.marginRight, ctx.y - 4.3, { align: 'right' });
  }
  entry.description.split(/\n+/).map(part => part.trim()).filter(Boolean).forEach((part) => {
    const bullet = /^[-•]\s*/.test(part);
    const lines = cleanSimpleSplitText(ctx, part.replace(/^[-•]\s*/, ''), ctx.contentWidth - (bullet ? 4 : 0));
    if (bullet && lines.length > 0) {
      cleanSimpleEnsureSpace(ctx, 4.05);
      cleanSimpleSetTextStyle(ctx, { size: 7.65, color: CLEAN_SIMPLE_DIRECT_MUTED, lineHeight: 4.05 });
      ctx.pdf.text('•', ctx.marginLeft, ctx.y);
      cleanSimpleDrawLines(ctx, lines, { size: 7.65, color: CLEAN_SIMPLE_DIRECT_MUTED, lineHeight: 4.05 }, { indentX: 4 });
    } else {
      cleanSimpleDrawLines(ctx, lines, { size: 7.65, color: CLEAN_SIMPLE_DIRECT_MUTED, lineHeight: 4.05 });
    }
  });
  ctx.y += 3.5;
}

function cleanSimpleDrawExperience(ctx: CleanSimpleDirectPdfContext, cv: CVData): void {
  if (cv.experience.length === 0) return;
  const leadBlockHeight = cleanSimpleSectionHeadingHeight() + cleanSimpleExperienceLeadBlockHeight(ctx, cv.experience[0]);
  cleanSimpleMoveToFreshPageIfNeeded(ctx, leadBlockHeight);
  cleanSimpleDrawSectionHeading(ctx, ctx.labels.experience);
  cv.experience.forEach(entry => cleanSimpleDrawExperienceEntry(ctx, entry));
}

function cleanSimpleEducationEntryHeight(ctx: CleanSimpleDirectPdfContext, edu: CVData['education'][number]): number {
  const degreeLines = cleanSimpleSplitText(ctx, edu.degree, ctx.contentWidth - 35);
  const schoolLines = edu.school ? cleanSimpleSplitText(ctx, edu.school) : [];
  return Math.max(4.3, degreeLines.length * 4.3) + schoolLines.length * 3.9 + 4;
}

function cleanSimpleEducationHeight(ctx: CleanSimpleDirectPdfContext, cv: CVData): number {
  if (cv.education.length === 0) return 0;
  let height = cleanSimpleSectionHeadingHeight();
  cv.education.forEach((edu) => {
    height += cleanSimpleEducationEntryHeight(ctx, edu);
  });
  return height + 2;
}

function cleanSimpleDrawEducationEntry(ctx: CleanSimpleDirectPdfContext, edu: CVData['education'][number]): void {
  const entryHeight = cleanSimpleEducationEntryHeight(ctx, edu);
  cleanSimpleMoveToFreshPageIfNeeded(ctx, entryHeight);
  cleanSimpleDrawLines(ctx, cleanSimpleSplitText(ctx, edu.degree, ctx.contentWidth - 35), {
    size: 7.9,
    color: CLEAN_SIMPLE_DIRECT_TEXT,
    fontStyle: 'bold',
    lineHeight: 4.3,
  });
  const dateText = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
  if (dateText) {
    cleanSimpleSetTextStyle(ctx, { size: 7.1, color: CLEAN_SIMPLE_DIRECT_LIGHT, lineHeight: 3.5 });
    ctx.pdf.text(dateText, ctx.pageWidth - ctx.marginRight, ctx.y - 4.3, { align: 'right' });
  }
  if (edu.school) {
    cleanSimpleDrawLinesBlock(ctx, cleanSimpleSplitText(ctx, edu.school), {
      size: 7.35,
      color: CLEAN_SIMPLE_DIRECT_MUTED,
      lineHeight: 3.9,
    });
  }
  ctx.y += 3.5;
}

function cleanSimpleDrawEducation(ctx: CleanSimpleDirectPdfContext, cv: CVData): void {
  if (cv.education.length === 0) return;
  const fullHeight = cleanSimpleEducationHeight(ctx, cv);
  const headingPlusFirst = cleanSimpleSectionHeadingHeight() + cleanSimpleEducationEntryHeight(ctx, cv.education[0]);
  const freshCapacity = cleanSimpleFreshPageCapacity(ctx);
  if (fullHeight <= freshCapacity) {
    cleanSimpleMoveToFreshPageIfNeeded(ctx, fullHeight);
  } else {
    cleanSimpleMoveToFreshPageIfNeeded(ctx, headingPlusFirst);
  }
  cleanSimpleDrawSectionHeading(ctx, ctx.labels.education);
  cv.education.forEach(edu => cleanSimpleDrawEducationEntry(ctx, edu));
}

function cleanSimplePipeLines(ctx: CleanSimpleDirectPdfContext, items: string[]): string[] {
  return cleanSimpleSplitText(ctx, items.join(' | '));
}

function cleanSimpleSkillsLanguagesHeight(ctx: CleanSimpleDirectPdfContext, cv: CVData, locale: Locale): number {
  let height = 0;
  if (cv.skills.length > 0) {
    const skills = cv.skills.map(skill => getLocalizedCvSkillName(skill, locale));
    height += cleanSimpleMeasureSectionWithLines(cleanSimplePipeLines(ctx, skills), {
      size: 7.65,
      color: CLEAN_SIMPLE_DIRECT_MUTED,
      lineHeight: 4.05,
    });
  }
  if (cv.languages.length > 0) {
    const languages = cv.languages.map(language => `${getLocalizedCvLanguageName(language.name, locale)} (${language.level})`);
    height += cleanSimpleMeasureSectionWithLines(cleanSimplePipeLines(ctx, languages), {
      size: 7.65,
      color: CLEAN_SIMPLE_DIRECT_MUTED,
      lineHeight: 4.05,
    });
  }
  return height;
}

function cleanSimpleDrawSkillsLanguages(ctx: CleanSimpleDirectPdfContext, cv: CVData, locale: Locale): void {
  const sectionStyle: CleanSimpleTextStyle = { size: 7.65, color: CLEAN_SIMPLE_DIRECT_MUTED, lineHeight: 4.05 };
  const skillsLines = cv.skills.length > 0
    ? cleanSimplePipeLines(ctx, cv.skills.map(skill => getLocalizedCvSkillName(skill, locale)))
    : [];
  const languageLines = cv.languages.length > 0
    ? cleanSimplePipeLines(ctx, cv.languages.map(language => `${getLocalizedCvLanguageName(language.name, locale)} (${language.level})`))
    : [];
  const skillsHeight = skillsLines.length > 0
    ? cleanSimpleMeasureSectionWithLines(skillsLines, sectionStyle)
    : 0;
  const languagesHeight = languageLines.length > 0
    ? cleanSimpleMeasureSectionWithLines(languageLines, sectionStyle)
    : 0;
  const combinedHeight = skillsHeight + languagesHeight;
  const freshCapacity = cleanSimpleFreshPageCapacity(ctx);
  if (combinedHeight > 0 && combinedHeight <= freshCapacity) {
    cleanSimpleMoveToFreshPageIfNeeded(ctx, combinedHeight);
  }
  if (skillsLines.length > 0) {
    cleanSimpleDrawAtomicSection(ctx, ctx.labels.skills, skillsLines, sectionStyle);
  }
  if (languageLines.length > 0) {
    cleanSimpleDrawAtomicSection(ctx, ctx.labels.languages, languageLines, sectionStyle);
  }
}

function cleanSimpleCertificationsHeight(ctx: CleanSimpleDirectPdfContext, cv: CVData): number {
  if (cv.certifications.length === 0) return 0;
  const lines = cv.certifications.flatMap(cert => cleanSimpleSplitText(ctx, cert));
  return cleanSimpleMeasureSectionWithLines(lines, { size: 7.65, color: CLEAN_SIMPLE_DIRECT_MUTED, lineHeight: 4.05 });
}

export async function buildCleanSimplePagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginLeft = 14;
  const marginRight = 14;
  const marginTop = 14;
  const marginBottom = 14;
  const ctx: CleanSimpleDirectPdfContext = {
    pdf,
    locale,
    labels: getCleanSimplePdfLabels(locale),
    pageWidth: CV_PDF_A4_WIDTH_MM,
    pageHeight: CV_PDF_A4_HEIGHT_MM,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    contentWidth: CV_PDF_A4_WIDTH_MM - marginLeft - marginRight,
    bottomSafeY: CV_PDF_A4_HEIGHT_MM - marginBottom,
    y: marginTop,
  };

  cleanSimpleDrawHeader(ctx, cv, options.photoDataUrl ?? null);
  cleanSimpleDrawSummary(ctx, cv.summary);
  cleanSimpleDrawExperience(ctx, cv);

  const educationHeight = cleanSimpleEducationHeight(ctx, cv);
  const skillsLanguagesHeight = cleanSimpleSkillsLanguagesHeight(ctx, cv, locale);
  const certificationsHeight = cleanSimpleCertificationsHeight(ctx, cv);
  const lowerSectionsHeight = educationHeight + skillsLanguagesHeight + certificationsHeight;
  const freshPageCapacity = cleanSimpleFreshPageCapacity(ctx);
  if (lowerSectionsHeight > 0 && lowerSectionsHeight <= freshPageCapacity && ctx.y + lowerSectionsHeight > ctx.bottomSafeY) {
    cleanSimpleStartPage(ctx);
  }

  if (educationHeight > 0) {
    cleanSimpleDrawEducation(ctx, cv);
  }
  if (skillsLanguagesHeight > 0) {
    cleanSimpleDrawSkillsLanguages(ctx, cv, locale);
  }
  if (certificationsHeight > 0) {
    const certLines = cv.certifications.flatMap(cert => cleanSimpleSplitText(ctx, cert));
    cleanSimpleDrawAtomicSection(ctx, ctx.labels.certifications, certLines, {
      size: 7.65,
      color: CLEAN_SIMPLE_DIRECT_MUTED,
      lineHeight: 4.05,
    });
  }

  const output = pdf.output('blob');
  return output instanceof Blob ? output : new Blob([output], { type: 'application/pdf' });
}

export async function buildCleanSimplePdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  const photoDataUrl = await prepareCleanSimplePdfPhotoDataUrl(cv);
  const blob = await buildCleanSimplePagedPdfBlob(cv, locale, { photoDataUrl });
  if (!blob || blob.size === 0) throw new Error('Clean Simple PDF generation produced an empty Blob');
  return blob;
}

export async function exportCleanSimplePdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildCleanSimplePdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

// Canonical square + circular crop for the Professional Classic PDF header photo.
// Used only as a fallback when cv.personal.photo (the user's own framed crop) is
// unavailable and we must derive a square crop from the raw originalPhoto instead.
function cropProfessionalClassicPdfPhoto(dataUrl: string, outputSize: number): Promise<string> {
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
      const sy = isPortrait ? -(scaledH - outputSize) * 0.32 : (outputSize - scaledH) / 2;
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, scaledW, scaledH);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function prepareProfessionalClassicPdfPhotoDataUrl(cv: CVData): Promise<string | null> {
  const showPhoto = cv.personal.photoEnabled !== undefined
    ? cv.personal.photoEnabled
    : cv.region !== 'US';
  if (!showPhoto) return null;

  const personalPhotos = cv.personal as CVData['personal'] & {
    originalPhoto?: string;
  };
  // Prefer cv.personal.photo — the circular crop the user already framed themselves
  // in the in-app photo cropper — matching the Professional Classic DOCX export.
  // originalPhoto is only used as a fallback for the rare case a selected photo is
  // missing.
  const source = cv.personal.photo?.trim() || personalPhotos.originalPhoto?.trim();
  if (!source) return null;

  const prepared = await prepareCvPhotoForExport(source);
  if (!prepared?.dataUrl) return null;
  const decoded = await decodeImageForExport(prepared.dataUrl);
  if (!decoded) return null;

  try {
    return await cropProfessionalClassicPdfPhoto(prepared.dataUrl, 512);
  } catch {
    return prepared.dataUrl;
  }
}

type ProfessionalClassicPdfWriter = InstanceType<typeof import('jspdf').jsPDF>;

type ProfessionalClassicDirectPdfContext = {
  pdf: ProfessionalClassicPdfWriter;
  locale: Locale;
  labels: ReturnType<typeof getProfessionalClassicPdfLabels>;
  pageWidth: number;
  pageHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  contentWidth: number;
  bottomSafeY: number;
  y: number;
};

type ProfessionalClassicTextStyle = {
  size: number;
  color: [number, number, number];
  fontStyle?: 'normal' | 'bold' | 'italic';
  lineHeight: number;
};

const PRO_CLASSIC_DARK: [number, number, number] = [31, 41, 55];
const PRO_CLASSIC_HEADING: [number, number, number] = [30, 41, 59];
const PRO_CLASSIC_TEXT: [number, number, number] = [17, 24, 39];
const PRO_CLASSIC_CHIP_TEXT: [number, number, number] = [55, 65, 81];
const PRO_CLASSIC_MUTED: [number, number, number] = [107, 114, 128];
const PRO_CLASSIC_MUTED2: [number, number, number] = [75, 85, 99];
const PRO_CLASSIC_DATE: [number, number, number] = [156, 163, 175];
const PRO_CLASSIC_RULE: [number, number, number] = [226, 232, 240];
const PRO_CLASSIC_CHIP_BG: [number, number, number] = [241, 245, 249];
const PRO_CLASSIC_SKILLS_LANG_GAP_MM = 6.35;

function getProfessionalClassicPdfLabels(locale: Locale) {
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

function proClassicDirectDateRange(start: string, end: string, present: boolean, presentLabel: string): string {
  return [start, present ? presentLabel : end].filter(Boolean).join(' - ');
}

function proClassicSetTextStyle(ctx: ProfessionalClassicDirectPdfContext, style: ProfessionalClassicTextStyle): void {
  ctx.pdf.setFont('helvetica', style.fontStyle ?? 'normal');
  ctx.pdf.setFontSize(style.size);
  ctx.pdf.setTextColor(style.color[0], style.color[1], style.color[2]);
}

function proClassicSplitText(ctx: ProfessionalClassicDirectPdfContext, text: string, maxWidth = ctx.contentWidth): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const result = ctx.pdf.splitTextToSize(normalized, maxWidth);
  return Array.isArray(result) ? result.map(String) : [String(result)];
}

function proClassicStartPage(ctx: ProfessionalClassicDirectPdfContext): void {
  ctx.pdf.addPage();
  ctx.y = ctx.marginTop;
}

function proClassicFreshPageCapacity(ctx: ProfessionalClassicDirectPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

function proClassicEnsureSpace(ctx: ProfessionalClassicDirectPdfContext, heightNeeded: number): void {
  if (ctx.y + heightNeeded <= ctx.bottomSafeY) return;
  proClassicStartPage(ctx);
}

function proClassicMoveToFreshPageIfNeeded(ctx: ProfessionalClassicDirectPdfContext, blockHeight: number): void {
  const freshCapacity = proClassicFreshPageCapacity(ctx);
  if (blockHeight > freshCapacity) return;
  if (ctx.y + blockHeight > ctx.bottomSafeY) {
    proClassicStartPage(ctx);
  }
}

function proClassicSectionHeadingHeight(): number {
  return 7.2;
}

function proClassicDrawSectionHeading(ctx: ProfessionalClassicDirectPdfContext, label: string): void {
  proClassicEnsureSpace(ctx, proClassicSectionHeadingHeight());
  proClassicSetTextStyle(ctx, { size: 9, color: PRO_CLASSIC_HEADING, fontStyle: 'bold', lineHeight: 3.5 });
  ctx.pdf.text(label.toUpperCase(), ctx.marginLeft, ctx.y);
  const ruleY = ctx.y + 1.6;
  ctx.pdf.setDrawColor(PRO_CLASSIC_RULE[0], PRO_CLASSIC_RULE[1], PRO_CLASSIC_RULE[2]);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.marginLeft, ruleY, ctx.pageWidth - ctx.marginRight, ruleY);
  ctx.y += proClassicSectionHeadingHeight();
}

function proClassicDrawLines(
  ctx: ProfessionalClassicDirectPdfContext,
  lines: string[],
  style: ProfessionalClassicTextStyle,
  options: { indentX?: number; x?: number } = {},
): void {
  proClassicSetTextStyle(ctx, style);
  const x = options.x ?? (ctx.marginLeft + (options.indentX ?? 0));
  for (const line of lines) {
    proClassicEnsureSpace(ctx, style.lineHeight);
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function proClassicDrawLinesBlock(
  ctx: ProfessionalClassicDirectPdfContext,
  lines: string[],
  style: ProfessionalClassicTextStyle,
  options: { indentX?: number; x?: number } = {},
): void {
  if (lines.length === 0) return;
  const blockHeight = lines.length * style.lineHeight;
  proClassicMoveToFreshPageIfNeeded(ctx, blockHeight);
  proClassicSetTextStyle(ctx, style);
  const x = options.x ?? (ctx.marginLeft + (options.indentX ?? 0));
  for (const line of lines) {
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function proClassicDrawHeader(ctx: ProfessionalClassicDirectPdfContext, cv: CVData, photoDataUrl: string | null): void {
  const headerPadX = ctx.marginLeft;
  const headerPadY = 7;
  const photoSize = 24;
  const gap = 4.2;
  const textX = photoDataUrl ? headerPadX + photoSize + gap : headerPadX;
  let textStackHeight = 6;
  if (cv.personal.jobTitle) textStackHeight += 5;
  const region = regionSettings[cv.region];
  const contacts = [cv.personal.email, cv.personal.phone, region.showAddress ? cv.personal.address : ''].filter(Boolean);
  if (contacts.length > 0) textStackHeight += 5;
  const headerHeight = Math.max(photoSize + headerPadY * 2, textStackHeight + headerPadY * 2);

  ctx.pdf.setFillColor(PRO_CLASSIC_DARK[0], PRO_CLASSIC_DARK[1], PRO_CLASSIC_DARK[2]);
  ctx.pdf.rect(0, 0, ctx.pageWidth, headerHeight, 'F');

  if (photoDataUrl) {
    try {
      ctx.pdf.addImage(photoDataUrl, 'PNG', headerPadX, headerPadY, photoSize, photoSize);
    } catch {
      try {
        ctx.pdf.addImage(photoDataUrl, 'JPEG', headerPadX, headerPadY, photoSize, photoSize);
      } catch {
        // Keep PDF export usable if jsPDF rejects an image data URL.
      }
    }
  }

  proClassicSetTextStyle(ctx, { size: 16.5, color: [255, 255, 255], fontStyle: 'bold', lineHeight: 6 });
  ctx.pdf.text(cv.personal.fullName || 'Your Name', textX, headerPadY + 5);
  if (cv.personal.jobTitle) {
    proClassicSetTextStyle(ctx, { size: 9, color: [203, 213, 225], lineHeight: 4 });
    ctx.pdf.text(cv.personal.jobTitle, textX, headerPadY + 11);
  }
  if (contacts.length > 0) {
    proClassicSetTextStyle(ctx, { size: 7.2, color: [148, 163, 184], lineHeight: 4 });
    ctx.pdf.text(contacts.join('  |  '), textX, headerPadY + 17);
  }

  ctx.y = headerHeight + 3.7;
}

function proClassicDrawSummary(ctx: ProfessionalClassicDirectPdfContext, summary: string): void {
  const blocks = splitCleanSimpleSummaryParagraphBlocks(summary);
  if (blocks.length === 0) return;
  const style: ProfessionalClassicTextStyle = { size: 8, color: PRO_CLASSIC_CHIP_TEXT, lineHeight: 4.1 };
  proClassicEnsureSpace(ctx, proClassicSectionHeadingHeight());
  proClassicDrawSectionHeading(ctx, ctx.labels.summary);
  blocks.forEach((block, index) => {
    proClassicDrawLines(ctx, proClassicSplitText(ctx, block), style);
    if (index < blocks.length - 1) ctx.y += 2.5;
  });
  ctx.y += 4;
}

function proClassicExperienceLeadBlockHeight(ctx: ProfessionalClassicDirectPdfContext, entry: CVData['experience'][number]): number {
  return proClassicEstimateExperienceLeadBlockHeight(ctx, entry);
}

function proClassicExperienceDescriptionParts(
  ctx: ProfessionalClassicDirectPdfContext,
  entry: CVData['experience'][number],
): Array<{ isBullet: boolean; lines: string[] }> {
  return entry.description
    .split(/\n+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map((part) => {
      const cleaned = part.replace(/^(?:[-•*]|\d+\.)\s+/, '');
      const isBullet = cleaned !== part;
      return {
        isBullet,
        lines: proClassicSplitText(ctx, cleaned, ctx.contentWidth - (isBullet ? 4 : 0)),
      };
    });
}

function proClassicMeasureExperiencePartHeight(part: { lines: string[] }): number {
  return part.lines.length * 3.9;
}

function proClassicEstimateExperienceEntryHeaderHeight(ctx: ProfessionalClassicDirectPdfContext, entry: CVData['experience'][number]): number {
  const titleLines = proClassicSplitText(ctx, entry.position, ctx.contentWidth - 32);
  return Math.max(4.5, titleLines.length * 4.3) + (entry.company ? 3.8 : 0);
}

function proClassicEstimateExperienceLeadBlockHeight(ctx: ProfessionalClassicDirectPdfContext, entry: CVData['experience'][number]): number {
  const parts = proClassicExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(part => part.isBullet);
  const leadParts = (bulletParts.length > 0 ? bulletParts : parts).slice(0, 2);
  const headerHeight = proClassicEstimateExperienceEntryHeaderHeight(ctx, entry);
  const leadHeight = leadParts.reduce((total, part) => total + proClassicMeasureExperiencePartHeight(part), 0);
  return headerHeight + leadHeight + 2.5;
}

function proClassicExperienceEntryHeight(ctx: ProfessionalClassicDirectPdfContext, entry: CVData['experience'][number]): number {
  const parts = proClassicExperienceDescriptionParts(ctx, entry);
  const headerHeight = proClassicEstimateExperienceEntryHeaderHeight(ctx, entry);
  const bodyHeight = parts.reduce((total, part) => total + proClassicMeasureExperiencePartHeight(part), 0);
  return headerHeight + bodyHeight + 2.5;
}

function proClassicDrawWrappedBulletLinesAtomic(
  ctx: ProfessionalClassicDirectPdfContext,
  part: { isBullet: boolean; lines: string[] },
): void {
  if (part.lines.length === 0) return;
  const blockHeight = proClassicMeasureExperiencePartHeight(part);
  proClassicMoveToFreshPageIfNeeded(ctx, blockHeight);
  const style: ProfessionalClassicTextStyle = { size: 7.6, color: PRO_CLASSIC_MUTED2, lineHeight: 3.9 };
  if (part.isBullet) {
    proClassicSetTextStyle(ctx, style);
    ctx.pdf.text('•', ctx.marginLeft, ctx.y);
    proClassicDrawLinesBlock(ctx, part.lines, style, { indentX: 4 });
    return;
  }
  proClassicDrawLinesBlock(ctx, part.lines, style);
}

function proClassicDrawExperienceEntryHeader(ctx: ProfessionalClassicDirectPdfContext, entry: CVData['experience'][number]): void {
  const dateText = proClassicDirectDateRange(entry.startDate, entry.endDate, entry.isPresent, ctx.labels.present);
  const titleLines = proClassicSplitText(ctx, entry.position, ctx.contentWidth - 32);
  proClassicDrawLinesBlock(ctx, titleLines, { size: 8.1, color: PRO_CLASSIC_TEXT, fontStyle: 'bold', lineHeight: 4.3 });
  if (dateText) {
    proClassicSetTextStyle(ctx, { size: 7.1, color: PRO_CLASSIC_DATE, fontStyle: 'italic', lineHeight: 3.5 });
    ctx.pdf.text(dateText, ctx.pageWidth - ctx.marginRight, ctx.y - 4.3, { align: 'right' });
  }
  if (entry.company) {
    proClassicDrawLinesBlock(ctx, [entry.company], { size: 7.5, color: PRO_CLASSIC_MUTED, lineHeight: 3.8 });
  }
}

function proClassicDrawExperienceContinuationHeader(ctx: ProfessionalClassicDirectPdfContext, entry: CVData['experience'][number]): void {
  const dateText = proClassicDirectDateRange(entry.startDate, entry.endDate, entry.isPresent, ctx.labels.present);
  proClassicEnsureSpace(ctx, 4.2);
  proClassicSetTextStyle(ctx, { size: 7.6, color: PRO_CLASSIC_MUTED, fontStyle: 'italic', lineHeight: 3.8 });
  const label = `${entry.position} (continued)`;
  ctx.pdf.text(label, ctx.marginLeft, ctx.y);
  if (dateText) {
    ctx.pdf.text(dateText, ctx.pageWidth - ctx.marginRight, ctx.y, { align: 'right' });
  }
  ctx.y += 4.2;
}

function proClassicDrawExperienceEntryPaginated(ctx: ProfessionalClassicDirectPdfContext, entry: CVData['experience'][number]): void {
  const parts = proClassicExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(part => part.isBullet);
  const leadParts = (bulletParts.length > 0 ? bulletParts : parts).slice(0, 2);
  const tailParts = (bulletParts.length > 0 ? bulletParts : parts).slice(leadParts.length);
  const leadBlockHeight = proClassicEstimateExperienceLeadBlockHeight(ctx, entry);
  const fullEntryHeight = proClassicExperienceEntryHeight(ctx, entry);
  const remainingSpace = ctx.bottomSafeY - ctx.y;
  const freshCapacity = proClassicFreshPageCapacity(ctx);

  if (fullEntryHeight <= remainingSpace) {
    proClassicDrawExperienceEntryHeader(ctx, entry);
    parts.forEach(part => proClassicDrawWrappedBulletLinesAtomic(ctx, part));
    ctx.y += 2.5;
    return;
  }

  if (leadBlockHeight > remainingSpace && leadBlockHeight <= freshCapacity) {
    proClassicStartPage(ctx);
  }

  proClassicDrawExperienceEntryHeader(ctx, entry);
  leadParts.forEach(part => proClassicDrawWrappedBulletLinesAtomic(ctx, part));

  let continuationShown = false;
  tailParts.forEach((part) => {
    const partHeight = proClassicMeasureExperiencePartHeight(part);
    if (ctx.y + partHeight > ctx.bottomSafeY) {
      proClassicStartPage(ctx);
      if (!continuationShown) {
        proClassicDrawExperienceContinuationHeader(ctx, entry);
        continuationShown = true;
      }
    }
    proClassicDrawWrappedBulletLinesAtomic(ctx, part);
  });
  ctx.y += 2.5;
}

function proClassicDrawExperience(ctx: ProfessionalClassicDirectPdfContext, cv: CVData): void {
  if (cv.experience.length === 0) return;
  const leadBlockHeight = proClassicSectionHeadingHeight() + proClassicExperienceLeadBlockHeight(ctx, cv.experience[0]);
  proClassicMoveToFreshPageIfNeeded(ctx, leadBlockHeight);
  proClassicDrawSectionHeading(ctx, ctx.labels.experience);
  cv.experience.forEach(entry => proClassicDrawExperienceEntryPaginated(ctx, entry));
}

function proClassicEducationEntryHeight(ctx: ProfessionalClassicDirectPdfContext, edu: CVData['education'][number]): number {
  const degreeHeight = Math.max(4.3, proClassicSplitText(ctx, edu.degree, ctx.contentWidth - 32).length * 4.3);
  const schoolHeight = edu.school ? proClassicSplitText(ctx, edu.school).length * 3.8 : 0;
  const descHeight = edu.description ? proClassicSplitText(ctx, edu.description).length * 3.9 : 0;
  return degreeHeight + schoolHeight + descHeight + 3;
}

function proClassicDrawEducationEntry(ctx: ProfessionalClassicDirectPdfContext, edu: CVData['education'][number]): void {
  const entryHeight = proClassicEducationEntryHeight(ctx, edu);
  proClassicMoveToFreshPageIfNeeded(ctx, entryHeight);
  const dateText = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
  const degreeLines = proClassicSplitText(ctx, edu.degree, ctx.contentWidth - 32);
  proClassicDrawLinesBlock(ctx, degreeLines, { size: 7.9, color: PRO_CLASSIC_TEXT, fontStyle: 'bold', lineHeight: 4.3 });
  if (dateText) {
    proClassicSetTextStyle(ctx, { size: 7.1, color: PRO_CLASSIC_DATE, lineHeight: 3.5 });
    ctx.pdf.text(dateText, ctx.pageWidth - ctx.marginRight, ctx.y - 4.3, { align: 'right' });
  }
  if (edu.school) {
    proClassicDrawLinesBlock(ctx, [edu.school], { size: 7.4, color: PRO_CLASSIC_MUTED, lineHeight: 3.8 });
  }
  if (edu.description) {
    proClassicDrawLinesBlock(ctx, proClassicSplitText(ctx, edu.description), { size: 7.6, color: PRO_CLASSIC_CHIP_TEXT, lineHeight: 3.9 });
  }
  ctx.y += 2;
}

function proClassicEducationHeight(ctx: ProfessionalClassicDirectPdfContext, cv: CVData): number {
  if (cv.education.length === 0) return 0;
  let height = proClassicSectionHeadingHeight();
  cv.education.forEach(edu => {
    height += proClassicEducationEntryHeight(ctx, edu);
  });
  return height + 2;
}

function proClassicDrawEducation(ctx: ProfessionalClassicDirectPdfContext, cv: CVData): void {
  if (cv.education.length === 0) return;
  const fullHeight = proClassicEducationHeight(ctx, cv);
  const headingPlusFirst = proClassicSectionHeadingHeight() + proClassicEducationEntryHeight(ctx, cv.education[0]);
  const freshCapacity = proClassicFreshPageCapacity(ctx);
  if (fullHeight <= freshCapacity) {
    proClassicMoveToFreshPageIfNeeded(ctx, fullHeight);
  } else {
    proClassicMoveToFreshPageIfNeeded(ctx, headingPlusFirst);
  }
  proClassicDrawSectionHeading(ctx, ctx.labels.education);
  cv.education.forEach(edu => proClassicDrawEducationEntry(ctx, edu));
}

type ProClassicSkillChipLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
};

function proClassicMeasureSkillChip(
  ctx: ProfessionalClassicDirectPdfContext,
  label: string,
  maxColWidth: number,
): { width: number; height: number; lines: string[] } {
  const padH = 1.85;
  const padV = 0.75;
  const lineH = 3.2;
  const chipStyle: ProfessionalClassicTextStyle = { size: 7.2, color: PRO_CLASSIC_CHIP_TEXT, lineHeight: lineH };
  proClassicSetTextStyle(ctx, chipStyle);
  const textWidth = ctx.pdf.getTextWidth(label);
  const singleLineChipWidth = textWidth + padH * 2;
  if (singleLineChipWidth <= maxColWidth) {
    return { width: singleLineChipWidth, height: lineH + padV * 2, lines: [label] };
  }
  const lines = proClassicSplitText(ctx, label, maxColWidth - padH * 2);
  return { width: maxColWidth, height: lines.length * lineH + padV * 2, lines };
}

function proClassicLayoutSkillChips(
  ctx: ProfessionalClassicDirectPdfContext,
  skills: string[],
  maxColWidth: number,
): { chips: ProClassicSkillChipLayout[]; totalHeight: number } {
  const gapX = 1.1;
  const gapY = 1.1;
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  const chips: ProClassicSkillChipLayout[] = [];
  skills.forEach((skill) => {
    const measured = proClassicMeasureSkillChip(ctx, skill, maxColWidth);
    if (cursorX > 0 && cursorX + measured.width > maxColWidth) {
      cursorY += rowHeight + gapY;
      cursorX = 0;
      rowHeight = 0;
    }
    chips.push({
      x: cursorX,
      y: cursorY,
      width: measured.width,
      height: measured.height,
      lines: measured.lines,
    });
    cursorX += measured.width + gapX;
    rowHeight = Math.max(rowHeight, measured.height);
  });
  return { chips, totalHeight: cursorY + rowHeight };
}

function proClassicMeasureSkillChipsHeight(
  ctx: ProfessionalClassicDirectPdfContext,
  skills: string[],
  maxColWidth: number,
): number {
  if (skills.length === 0) return 0;
  return proClassicLayoutSkillChips(ctx, skills, maxColWidth).totalHeight;
}

function proClassicDrawSkillChips(
  ctx: ProfessionalClassicDirectPdfContext,
  skills: string[],
  colX: number,
  colY: number,
  maxColWidth: number,
): number {
  const layout = proClassicLayoutSkillChips(ctx, skills, maxColWidth);
  const padH = 1.85;
  const padV = 0.75;
  const lineH = 3.2;
  layout.chips.forEach((chip) => {
    const chipX = colX + chip.x;
    const chipY = colY + chip.y;
    ctx.pdf.setFillColor(PRO_CLASSIC_CHIP_BG[0], PRO_CLASSIC_CHIP_BG[1], PRO_CLASSIC_CHIP_BG[2]);
    ctx.pdf.roundedRect(chipX, chipY, chip.width, chip.height, 1, 1, 'F');
    proClassicSetTextStyle(ctx, { size: 7.2, color: PRO_CLASSIC_CHIP_TEXT, lineHeight: lineH });
    chip.lines.forEach((line, lineIndex) => {
      ctx.pdf.text(line, chipX + padH, chipY + padV + lineH * (lineIndex + 0.75));
    });
  });
  return layout.totalHeight;
}

function proClassicLanguagesHeight(ctx: ProfessionalClassicDirectPdfContext, cv: CVData): number {
  if (cv.languages.length === 0) return 0;
  return cv.languages.length * 3.8;
}

function proClassicSkillsLanguagesHeight(ctx: ProfessionalClassicDirectPdfContext, cv: CVData): number {
  const colWidth = (ctx.contentWidth - PRO_CLASSIC_SKILLS_LANG_GAP_MM) / 2;
  let skillsHeight = 0;
  let languagesHeight = 0;
  if (cv.skills.length > 0) {
    skillsHeight = proClassicSectionHeadingHeight() + proClassicMeasureSkillChipsHeight(ctx, cv.skills, colWidth) + 2;
  }
  if (cv.languages.length > 0) {
    languagesHeight = proClassicSectionHeadingHeight() + proClassicLanguagesHeight(ctx, cv) + 2;
  }
  return Math.max(skillsHeight, languagesHeight);
}

function proClassicDrawSectionHeadingAt(
  ctx: ProfessionalClassicDirectPdfContext,
  label: string,
  x: number,
  y: number,
): number {
  proClassicSetTextStyle(ctx, { size: 9, color: PRO_CLASSIC_HEADING, fontStyle: 'bold', lineHeight: 3.5 });
  ctx.pdf.text(label.toUpperCase(), x, y);
  const ruleY = y + 1.6;
  ctx.pdf.setDrawColor(PRO_CLASSIC_RULE[0], PRO_CLASSIC_RULE[1], PRO_CLASSIC_RULE[2]);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(x, ruleY, x + ((ctx.contentWidth - PRO_CLASSIC_SKILLS_LANG_GAP_MM) / 2), ruleY);
  return y + proClassicSectionHeadingHeight();
}

function proClassicDrawSkillsLanguages(ctx: ProfessionalClassicDirectPdfContext, cv: CVData): void {
  if (cv.skills.length === 0 && cv.languages.length === 0) return;
  const colWidth = (ctx.contentWidth - PRO_CLASSIC_SKILLS_LANG_GAP_MM) / 2;
  const skillsColX = ctx.marginLeft;
  const langsColX = ctx.marginLeft + colWidth + PRO_CLASSIC_SKILLS_LANG_GAP_MM;
  const blockHeight = proClassicSkillsLanguagesHeight(ctx, cv);
  proClassicMoveToFreshPageIfNeeded(ctx, blockHeight);

  const blockTopY = ctx.y;
  let maxBottom = blockTopY;

  if (cv.skills.length > 0) {
    const chipsTop = proClassicDrawSectionHeadingAt(ctx, ctx.labels.skills, skillsColX, blockTopY);
    const chipsHeight = proClassicDrawSkillChips(ctx, cv.skills, skillsColX, chipsTop, colWidth);
    maxBottom = Math.max(maxBottom, chipsTop + chipsHeight + 2);
  }

  if (cv.languages.length > 0) {
    let langsY = proClassicDrawSectionHeadingAt(ctx, ctx.labels.languages, langsColX, blockTopY);
    const langStyle: ProfessionalClassicTextStyle = { size: 7.6, color: PRO_CLASSIC_CHIP_TEXT, lineHeight: 3.8 };
    cv.languages.forEach((language) => {
      const line = `${getLocalizedCvLanguageName(language.name, ctx.locale)} - ${language.level}`;
      const lines = [line];
      proClassicSetTextStyle(ctx, langStyle);
      lines.forEach((textLine) => {
        ctx.pdf.text(textLine, langsColX, langsY);
        langsY += langStyle.lineHeight;
      });
    });
    maxBottom = Math.max(maxBottom, langsY + 2);
  }

  ctx.y = maxBottom;
}

function proClassicCertificationsHeight(ctx: ProfessionalClassicDirectPdfContext, cv: CVData): number {
  if (cv.certifications.length === 0) return 0;
  const lines = cv.certifications.flatMap(cert => proClassicSplitText(ctx, cert));
  return proClassicSectionHeadingHeight() + lines.length * 3.8 + 2;
}

function proClassicDrawCertifications(ctx: ProfessionalClassicDirectPdfContext, cv: CVData): void {
  if (cv.certifications.length === 0) return;
  const lines = cv.certifications.flatMap(cert => proClassicSplitText(ctx, cert));
  const blockHeight = proClassicSectionHeadingHeight() + lines.length * 3.8 + 2;
  proClassicMoveToFreshPageIfNeeded(ctx, blockHeight);
  proClassicDrawSectionHeading(ctx, ctx.labels.certifications);
  cv.certifications.forEach((cert) => {
    proClassicEnsureSpace(ctx, 3.8);
    proClassicSetTextStyle(ctx, { size: 7.6, color: PRO_CLASSIC_CHIP_TEXT, lineHeight: 3.8 });
    ctx.pdf.text('•', ctx.marginLeft, ctx.y);
    proClassicDrawLines(ctx, proClassicSplitText(ctx, cert), { size: 7.6, color: PRO_CLASSIC_CHIP_TEXT, lineHeight: 3.8 }, { indentX: 4 });
  });
  ctx.y += 2;
}

export async function buildProfessionalClassicPagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginLeft = 8.5;
  const marginRight = 8.5;
  const marginTop = 14;
  const marginBottom = 14;
  const ctx: ProfessionalClassicDirectPdfContext = {
    pdf,
    locale,
    labels: getProfessionalClassicPdfLabels(locale),
    pageWidth: CV_PDF_A4_WIDTH_MM,
    pageHeight: CV_PDF_A4_HEIGHT_MM,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    contentWidth: CV_PDF_A4_WIDTH_MM - marginLeft - marginRight,
    bottomSafeY: CV_PDF_A4_HEIGHT_MM - marginBottom,
    y: 0,
  };

  proClassicDrawHeader(ctx, cv, options.photoDataUrl ?? null);
  proClassicDrawSummary(ctx, cv.summary);
  proClassicDrawExperience(ctx, cv);

  const educationHeight = proClassicEducationHeight(ctx, cv);
  const skillsLanguagesHeight = proClassicSkillsLanguagesHeight(ctx, cv);
  const certificationsHeight = proClassicCertificationsHeight(ctx, cv);
  const lowerSectionsHeight = educationHeight + skillsLanguagesHeight + certificationsHeight;
  const freshPageCapacity = proClassicFreshPageCapacity(ctx);
  if (lowerSectionsHeight > 0 && lowerSectionsHeight <= freshPageCapacity && ctx.y + lowerSectionsHeight > ctx.bottomSafeY) {
    proClassicStartPage(ctx);
  }

  if (educationHeight > 0) {
    proClassicDrawEducation(ctx, cv);
  }
  if (skillsLanguagesHeight > 0) {
    proClassicDrawSkillsLanguages(ctx, cv);
  }
  if (certificationsHeight > 0) {
    proClassicDrawCertifications(ctx, cv);
  }

  const output = pdf.output('blob');
  return output instanceof Blob ? output : new Blob([output], { type: 'application/pdf' });
}

export async function buildProfessionalClassicPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  const photoDataUrl = await prepareProfessionalClassicPdfPhotoDataUrl(cv);
  const blob = await buildProfessionalClassicPagedPdfBlob(cv, locale, { photoDataUrl });
  if (!blob || blob.size === 0) throw new Error('Professional Classic PDF generation produced an empty Blob');
  return blob;
}

export async function exportProfessionalClassicPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildProfessionalClassicPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

// ─── Creative Bold Direct jsPDF Renderer ─────────────────────────────────────

function cropCreativeBoldPdfPhoto(dataUrl: string, outputSize: number): Promise<string> {
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
      const sy = isPortrait ? -(scaledH - outputSize) * 0.32 : (outputSize - scaledH) / 2;
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, scaledW, scaledH);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function prepareCreativeBoldPdfPhotoDataUrl(cv: CVData): Promise<string | null> {
  const showPhoto = cv.personal.photoEnabled !== undefined
    ? cv.personal.photoEnabled
    : cv.region !== 'US';
  if (!showPhoto) return null;

  const personalPhotos = cv.personal as CVData['personal'] & { originalPhoto?: string };
  const source = cv.personal.photo?.trim() || personalPhotos.originalPhoto?.trim();
  if (!source) return null;

  const prepared = await prepareCvPhotoForExport(source);
  if (!prepared?.dataUrl) return null;
  const decoded = await decodeImageForExport(prepared.dataUrl);
  if (!decoded) return null;

  try {
    return await cropCreativeBoldPdfPhoto(prepared.dataUrl, 512);
  } catch {
    return prepared.dataUrl;
  }
}

type CreativeBoldPdfWriter = InstanceType<typeof import('jspdf').jsPDF>;

type CreativeBoldDirectPdfContext = {
  pdf: CreativeBoldPdfWriter;
  locale: Locale;
  labels: ReturnType<typeof getCreativeBoldPdfLabels>;
  pageWidth: number;
  pageHeight: number;
  sidebarW: number;
  sidebarPad: number;
  mainX: number;
  mainPad: number;
  contentX: number;
  contentW: number;
  marginTop: number;
  marginBottom: number;
  bottomSafeY: number;
  y: number;
  pageIndex: number;
};

type CreativeBoldTextStyle = {
  size: number;
  color: [number, number, number];
  fontStyle?: 'normal' | 'bold' | 'italic';
  lineHeight: number;
};

const CB_SIDEBAR_RED: [number, number, number] = [190, 18, 60];
const CB_HEADING_RED: [number, number, number] = [225, 29, 72];
const CB_CB_WHITE: [number, number, number] = [255, 255, 255];
const CB_ROSE_100: [number, number, number] = [255, 228, 230];
const CB_ROSE_200_BORDER: [number, number, number] = [254, 205, 211];
const CB_CB_DARK: [number, number, number] = [17, 24, 39];
const CB_GRAY_600: [number, number, number] = [75, 85, 99];
const CB_GRAY_500_CB: [number, number, number] = [107, 114, 128];

function getCreativeBoldPdfLabels(locale: Locale) {
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

function cbDirectDateRange(start: string, end: string, present: boolean, presentLabel: string): string {
  return [start, present ? presentLabel : end].filter(Boolean).join(' - ');
}

function cbSetTextStyle(ctx: CreativeBoldDirectPdfContext, style: CreativeBoldTextStyle): void {
  ctx.pdf.setFont('helvetica', style.fontStyle ?? 'normal');
  ctx.pdf.setFontSize(style.size);
  ctx.pdf.setTextColor(style.color[0], style.color[1], style.color[2]);
}

function cbSplitText(ctx: CreativeBoldDirectPdfContext, text: string, maxWidth?: number): string[] {
  const w = maxWidth ?? ctx.contentW;
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const result = ctx.pdf.splitTextToSize(normalized, w);
  return Array.isArray(result) ? result.map(String) : [String(result)];
}

function cbFreshPageCapacity(ctx: CreativeBoldDirectPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

function cbDrawContinuationSidebar(ctx: CreativeBoldDirectPdfContext): void {
  ctx.pdf.setFillColor(CB_SIDEBAR_RED[0], CB_SIDEBAR_RED[1], CB_SIDEBAR_RED[2]);
  ctx.pdf.rect(0, 0, ctx.sidebarW, ctx.pageHeight, 'F');
}

function cbAddPage(ctx: CreativeBoldDirectPdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
  cbDrawContinuationSidebar(ctx);
}

function cbEnsureSpace(ctx: CreativeBoldDirectPdfContext, heightNeeded: number): void {
  if (ctx.y + heightNeeded <= ctx.bottomSafeY) return;
  cbAddPage(ctx);
}

function cbMoveToFreshPageIfNeeded(ctx: CreativeBoldDirectPdfContext, blockHeight: number): void {
  if (blockHeight > cbFreshPageCapacity(ctx)) return;
  if (ctx.y + blockHeight > ctx.bottomSafeY) {
    cbAddPage(ctx);
  }
}

function cbSectionHeadingHeight(): number {
  return 8.0;
}

function cbDrawSectionHeading(ctx: CreativeBoldDirectPdfContext, label: string): void {
  cbEnsureSpace(ctx, cbSectionHeadingHeight());
  cbSetTextStyle(ctx, { size: 8.5, color: CB_HEADING_RED, fontStyle: 'bold', lineHeight: 4.5 });
  ctx.pdf.text(label.toUpperCase(), ctx.contentX, ctx.y);
  ctx.y += cbSectionHeadingHeight();
}

function cbDrawLines(
  ctx: CreativeBoldDirectPdfContext,
  lines: string[],
  style: CreativeBoldTextStyle,
  opts: { x?: number; indentX?: number } = {},
): void {
  cbSetTextStyle(ctx, style);
  const x = opts.x ?? (ctx.contentX + (opts.indentX ?? 0));
  for (const line of lines) {
    cbEnsureSpace(ctx, style.lineHeight);
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function cbDrawLinesBlock(
  ctx: CreativeBoldDirectPdfContext,
  lines: string[],
  style: CreativeBoldTextStyle,
  opts: { x?: number } = {},
): void {
  if (!lines.length) return;
  const blockH = lines.length * style.lineHeight;
  cbMoveToFreshPageIfNeeded(ctx, blockH);
  cbSetTextStyle(ctx, style);
  const x = opts.x ?? ctx.contentX;
  for (const line of lines) {
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function cbDrawPage1Sidebar(
  ctx: CreativeBoldDirectPdfContext,
  cv: CVData,
  photoDataUrl: string | null,
): void {
  ctx.pdf.setFillColor(CB_SIDEBAR_RED[0], CB_SIDEBAR_RED[1], CB_SIDEBAR_RED[2]);
  ctx.pdf.rect(0, 0, ctx.sidebarW, ctx.pageHeight, 'F');

  const padX = ctx.sidebarPad;
  const contentW = ctx.sidebarW - 2 * padX;
  let sy = ctx.marginTop;

  const showPhoto = cv.personal.photoEnabled !== undefined
    ? cv.personal.photoEnabled
    : cv.region !== 'US';
  const photoSize = 26;
  if (showPhoto && photoDataUrl) {
    const photoX = (ctx.sidebarW - photoSize) / 2;
    try {
      ctx.pdf.addImage(photoDataUrl, 'PNG', photoX, sy, photoSize, photoSize);
    } catch {
      try {
        ctx.pdf.addImage(photoDataUrl, 'JPEG', photoX, sy, photoSize, photoSize);
      } catch {
        // Keep export usable if jsPDF rejects an image data URL.
      }
    }
    sy += photoSize + 7;
  }

  // Name
  ctx.pdf.setFont('helvetica', 'bold');
  ctx.pdf.setFontSize(11);
  ctx.pdf.setTextColor(CB_CB_WHITE[0], CB_CB_WHITE[1], CB_CB_WHITE[2]);
  const nameRaw = ctx.pdf.splitTextToSize(cv.personal.fullName || 'Your Name', contentW);
  const nameLines: string[] = Array.isArray(nameRaw) ? nameRaw.map(String) : [String(nameRaw)];
  for (const line of nameLines) {
    if (sy > ctx.pageHeight - 6) break;
    ctx.pdf.text(line, padX, sy);
    sy += 5.0;
  }

  // Job title
  if (cv.personal.jobTitle) {
    ctx.pdf.setFont('helvetica', 'normal');
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(CB_ROSE_100[0], CB_ROSE_100[1], CB_ROSE_100[2]);
    const titleRaw = ctx.pdf.splitTextToSize(cv.personal.jobTitle, contentW);
    const titleLines: string[] = Array.isArray(titleRaw) ? titleRaw.map(String) : [String(titleRaw)];
    for (const line of titleLines) {
      if (sy > ctx.pageHeight - 6) break;
      ctx.pdf.text(line, padX, sy);
      sy += 3.8;
    }
    sy += 1;
  }

  // Contact info
  sy += 4;
  const region = regionSettings[cv.region];
  const contacts = [
    cv.personal.email,
    cv.personal.phone,
    region.showAddress ? cv.personal.address : '',
  ].filter(Boolean) as string[];
  if (contacts.length > 0) {
    ctx.pdf.setFont('helvetica', 'normal');
    ctx.pdf.setFontSize(6.5);
    ctx.pdf.setTextColor(CB_ROSE_100[0], CB_ROSE_100[1], CB_ROSE_100[2]);
    for (const contact of contacts) {
      if (sy > ctx.pageHeight - 6) break;
      const raw = ctx.pdf.splitTextToSize(contact, contentW);
      const lines: string[] = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      for (const line of lines) {
        if (sy > ctx.pageHeight - 6) break;
        ctx.pdf.text(line, padX, sy);
        sy += 3.2;
      }
    }
  }

  // SKILLS
  if (cv.skills.length > 0 && sy <= ctx.pageHeight - 12) {
    sy += 6;
    ctx.pdf.setFont('helvetica', 'bold');
    ctx.pdf.setFontSize(6.5);
    ctx.pdf.setTextColor(CB_CB_WHITE[0], CB_CB_WHITE[1], CB_CB_WHITE[2]);
    ctx.pdf.text(ctx.labels.skills.toUpperCase(), padX, sy);
    sy += 4.5;
    ctx.pdf.setFont('helvetica', 'normal');
    ctx.pdf.setFontSize(6.5);
    for (const skill of cv.skills) {
      if (sy > ctx.pageHeight - 4) break;
      const raw = ctx.pdf.splitTextToSize(skill, contentW);
      const lines: string[] = Array.isArray(raw) ? raw.map(String) : [String(raw)];
      for (const line of lines) {
        if (sy > ctx.pageHeight - 4) break;
        ctx.pdf.text(line, padX, sy);
        sy += 3.2;
      }
      sy += 0.8;
    }
  }

  // LANGUAGES
  if (cv.languages.length > 0 && sy <= ctx.pageHeight - 14) {
    sy += 5;
    ctx.pdf.setFont('helvetica', 'bold');
    ctx.pdf.setFontSize(6.5);
    ctx.pdf.setTextColor(CB_CB_WHITE[0], CB_CB_WHITE[1], CB_CB_WHITE[2]);
    ctx.pdf.text(ctx.labels.languages.toUpperCase(), padX, sy);
    sy += 4.5;
    ctx.pdf.setFont('helvetica', 'normal');
    ctx.pdf.setFontSize(7);
    ctx.pdf.setTextColor(CB_ROSE_100[0], CB_ROSE_100[1], CB_ROSE_100[2]);
    for (const lang of cv.languages) {
      if (sy > ctx.pageHeight - 4) break;
      ctx.pdf.text(`${lang.name} - ${lang.level}`, padX, sy);
      sy += 3.5;
    }
  }
}

function cbDrawSummary(ctx: CreativeBoldDirectPdfContext, summary: string): void {
  const blocks = splitCleanSimpleSummaryParagraphBlocks(summary);
  if (!blocks.length) return;
  cbEnsureSpace(ctx, cbSectionHeadingHeight());
  cbDrawSectionHeading(ctx, ctx.labels.summary);
  const style: CreativeBoldTextStyle = { size: 8, color: CB_GRAY_600, lineHeight: 4.1 };
  blocks.forEach((block, i) => {
    cbDrawLines(ctx, cbSplitText(ctx, block), style);
    if (i < blocks.length - 1) ctx.y += 2.5;
  });
  ctx.y += 4;
}

function cbExperienceTextX(ctx: CreativeBoldDirectPdfContext): number {
  return ctx.contentX + 3.5;
}

function cbExperienceTextW(ctx: CreativeBoldDirectPdfContext): number {
  return ctx.contentX + ctx.contentW - cbExperienceTextX(ctx);
}

function cbExperienceDescriptionParts(
  ctx: CreativeBoldDirectPdfContext,
  entry: CVData['experience'][number],
): Array<{ isBullet: boolean; lines: string[] }> {
  const textW = cbExperienceTextW(ctx);
  return entry.description
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map((part) => {
      const cleaned = part.replace(/^(?:[-•*]|\d+\.)\s+/, '');
      const isBullet = cleaned !== part;
      return { isBullet, lines: cbSplitText(ctx, cleaned, textW - (isBullet ? 3.5 : 0)) };
    });
}

function cbExperienceLeadBlockHeight(
  ctx: CreativeBoldDirectPdfContext,
  entry: CVData['experience'][number],
): number {
  const textW = cbExperienceTextW(ctx);
  const titleLines = cbSplitText(ctx, entry.position, textW);
  const headerH = Math.max(4.0, titleLines.length * 4.0)
    + ((entry.company || entry.startDate) ? 3.5 : 0)
    + 1.5;
  const parts = cbExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(p => p.isBullet);
  const leadParts = (bulletParts.length ? bulletParts : parts).slice(0, 2);
  return headerH + leadParts.reduce((sum, p) => sum + p.lines.length * 3.8, 0);
}

function cbExperienceEntryHeight(
  ctx: CreativeBoldDirectPdfContext,
  entry: CVData['experience'][number],
): number {
  const textW = cbExperienceTextW(ctx);
  const titleLines = cbSplitText(ctx, entry.position, textW);
  const headerH = Math.max(4.0, titleLines.length * 4.0)
    + ((entry.company || entry.startDate) ? 3.5 : 0)
    + 1.5;
  const parts = cbExperienceDescriptionParts(ctx, entry);
  return headerH + parts.reduce((sum, p) => sum + p.lines.length * 3.8, 0) + 3;
}

function cbDrawWrappedBulletAtomic(
  ctx: CreativeBoldDirectPdfContext,
  part: { isBullet: boolean; lines: string[] },
  textX: number,
): void {
  if (!part.lines.length) return;
  const blockH = part.lines.length * 3.8;
  cbMoveToFreshPageIfNeeded(ctx, blockH);
  cbSetTextStyle(ctx, { size: 7.5, color: CB_GRAY_600, lineHeight: 3.8 });
  if (part.isBullet) ctx.pdf.text('•', textX, ctx.y);
  for (const line of part.lines) {
    ctx.pdf.text(line, textX + (part.isBullet ? 3.5 : 0), ctx.y);
    ctx.y += 3.8;
  }
}

function cbDrawExperienceEntryPaginated(
  ctx: CreativeBoldDirectPdfContext,
  entry: CVData['experience'][number],
): void {
  const dateText = cbDirectDateRange(entry.startDate, entry.endDate, entry.isPresent, ctx.labels.present);
  const accentX = ctx.contentX;
  const textX = cbExperienceTextX(ctx);
  const textW = cbExperienceTextW(ctx);

  const leadH = cbExperienceLeadBlockHeight(ctx, entry);
  const fullH = cbExperienceEntryHeight(ctx, entry);
  const remainingSpace = ctx.bottomSafeY - ctx.y;
  const freshCap = cbFreshPageCapacity(ctx);

  // If the full entry fits, draw it atomically
  if (fullH <= remainingSpace) {
    const startY = ctx.y;
    const titleLines = cbSplitText(ctx, entry.position, textW);
    cbDrawLinesBlock(ctx, titleLines, { size: 8.0, color: CB_CB_DARK, fontStyle: 'bold', lineHeight: 4.0 }, { x: textX });
    if (entry.company || dateText) {
      const meta = [entry.company, dateText].filter(Boolean).join(' | ');
      cbDrawLinesBlock(ctx, cbSplitText(ctx, meta, textW), { size: 7.0, color: CB_GRAY_500_CB, lineHeight: 3.5 }, { x: textX });
    }
    ctx.y += 1.5;
    const parts = cbExperienceDescriptionParts(ctx, entry);
    for (const part of parts) {
      if (!part.lines.length) continue;
      cbSetTextStyle(ctx, { size: 7.5, color: CB_GRAY_600, lineHeight: 3.8 });
      if (part.isBullet) ctx.pdf.text('•', textX, ctx.y);
      for (const line of part.lines) {
        ctx.pdf.text(line, textX + (part.isBullet ? 3.5 : 0), ctx.y);
        ctx.y += 3.8;
      }
    }
    ctx.pdf.setDrawColor(CB_ROSE_200_BORDER[0], CB_ROSE_200_BORDER[1], CB_ROSE_200_BORDER[2]);
    ctx.pdf.setLineWidth(0.8);
    ctx.pdf.line(accentX, startY - 1, accentX, ctx.y);
    ctx.y += 4;
    return;
  }

  // Lead block doesn't fit; move to fresh page if lead fits there
  if (leadH > remainingSpace && leadH <= freshCap) {
    cbAddPage(ctx);
  }

  const startY = ctx.y;
  const titleLines = cbSplitText(ctx, entry.position, textW);
  cbDrawLinesBlock(ctx, titleLines, { size: 8.0, color: CB_CB_DARK, fontStyle: 'bold', lineHeight: 4.0 }, { x: textX });
  if (entry.company || dateText) {
    const meta = [entry.company, dateText].filter(Boolean).join(' | ');
    cbDrawLinesBlock(ctx, cbSplitText(ctx, meta, textW), { size: 7.0, color: CB_GRAY_500_CB, lineHeight: 3.5 }, { x: textX });
  }
  ctx.y += 1.5;

  const parts = cbExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(p => p.isBullet);
  const useGrouped = bulletParts.length > 0;
  const leadParts = (useGrouped ? bulletParts : parts).slice(0, 2);
  const tailParts = (useGrouped ? bulletParts : parts).slice(leadParts.length);
  const nonBulletParts = useGrouped ? parts.filter(p => !p.isBullet) : [];

  // Draw lead parts (kept together with header on this page)
  for (const part of leadParts) {
    cbDrawWrappedBulletAtomic(ctx, part, textX);
  }

  // Accent line for header block
  ctx.pdf.setDrawColor(CB_ROSE_200_BORDER[0], CB_ROSE_200_BORDER[1], CB_ROSE_200_BORDER[2]);
  ctx.pdf.setLineWidth(0.8);
  ctx.pdf.line(accentX, startY - 1, accentX, ctx.y);

  // Draw any non-bullet prefix parts
  for (const part of nonBulletParts) {
    cbDrawWrappedBulletAtomic(ctx, part, textX);
  }

  // Draw tail parts page-by-page
  let continuationShown = false;
  let tailStartY = ctx.y;
  for (const part of tailParts) {
    const partH = part.lines.length * 3.8;
    if (ctx.y + partH > ctx.bottomSafeY) {
      cbAddPage(ctx);
      if (!continuationShown) {
        cbSetTextStyle(ctx, { size: 7.5, color: CB_CB_DARK, fontStyle: 'italic', lineHeight: 3.8 });
        ctx.pdf.text(`${entry.position} (continued)`, textX, ctx.y);
        ctx.y += 4.2;
        continuationShown = true;
      }
      tailStartY = ctx.y;
    }
    cbDrawWrappedBulletAtomic(ctx, part, textX);
    ctx.pdf.setDrawColor(CB_ROSE_200_BORDER[0], CB_ROSE_200_BORDER[1], CB_ROSE_200_BORDER[2]);
    ctx.pdf.setLineWidth(0.8);
    ctx.pdf.line(accentX, tailStartY - 1, accentX, ctx.y);
    tailStartY = ctx.y;
  }

  ctx.y += 4;
}

function cbDrawExperience(ctx: CreativeBoldDirectPdfContext, cv: CVData): void {
  if (!cv.experience.length) return;
  const leadH = cbSectionHeadingHeight() + cbExperienceLeadBlockHeight(ctx, cv.experience[0]);
  cbMoveToFreshPageIfNeeded(ctx, leadH);
  cbDrawSectionHeading(ctx, ctx.labels.experience);
  for (const entry of cv.experience) {
    cbDrawExperienceEntryPaginated(ctx, entry);
  }
}

function cbEducationEntryHeight(
  ctx: CreativeBoldDirectPdfContext,
  edu: CVData['education'][number],
): number {
  const degreeLines = cbSplitText(ctx, edu.degree);
  const degreeH = Math.max(4.0, degreeLines.length * 4.0);
  const metaH = (edu.school || edu.startDate || edu.endDate) ? 3.5 : 0;
  return degreeH + metaH + 2.5;
}

function cbDrawEducationEntry(
  ctx: CreativeBoldDirectPdfContext,
  edu: CVData['education'][number],
): void {
  const entryH = cbEducationEntryHeight(ctx, edu);
  cbMoveToFreshPageIfNeeded(ctx, entryH);
  const degreeLines = cbSplitText(ctx, edu.degree);
  cbDrawLinesBlock(ctx, degreeLines, { size: 8.0, color: CB_CB_DARK, fontStyle: 'bold', lineHeight: 4.0 });
  const dateParts = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
  const metaText = [edu.school, dateParts].filter(Boolean).join(' | ');
  if (metaText) {
    cbDrawLinesBlock(ctx, cbSplitText(ctx, metaText), { size: 7.0, color: CB_GRAY_500_CB, lineHeight: 3.5 });
  }
  ctx.y += 2.5;
}

function cbEducationHeight(ctx: CreativeBoldDirectPdfContext, cv: CVData): number {
  if (!cv.education.length) return 0;
  let h = cbSectionHeadingHeight();
  for (const edu of cv.education) h += cbEducationEntryHeight(ctx, edu);
  return h + 2;
}

function cbDrawEducation(ctx: CreativeBoldDirectPdfContext, cv: CVData): void {
  if (!cv.education.length) return;
  const fullH = cbEducationHeight(ctx, cv);
  const headingPlusFirst = cbSectionHeadingHeight() + cbEducationEntryHeight(ctx, cv.education[0]);
  const freshCap = cbFreshPageCapacity(ctx);
  if (fullH <= freshCap) {
    cbMoveToFreshPageIfNeeded(ctx, fullH);
  } else {
    cbMoveToFreshPageIfNeeded(ctx, headingPlusFirst);
  }
  cbDrawSectionHeading(ctx, ctx.labels.education);
  for (const edu of cv.education) cbDrawEducationEntry(ctx, edu);
}

function cbCertificationsHeight(ctx: CreativeBoldDirectPdfContext, cv: CVData): number {
  if (!cv.certifications.length) return 0;
  let h = cbSectionHeadingHeight();
  for (const cert of cv.certifications) h += cbSplitText(ctx, cert, ctx.contentW - 3.5).length * 3.8 + 1;
  return h;
}

function cbDrawCertifications(ctx: CreativeBoldDirectPdfContext, cv: CVData): void {
  if (!cv.certifications.length) return;
  cbMoveToFreshPageIfNeeded(ctx, cbSectionHeadingHeight() + 6);
  cbDrawSectionHeading(ctx, ctx.labels.certifications);
  for (const cert of cv.certifications) {
    cbEnsureSpace(ctx, 3.8);
    cbSetTextStyle(ctx, { size: 7.5, color: CB_GRAY_600, lineHeight: 3.8 });
    ctx.pdf.text('•', ctx.contentX, ctx.y);
    cbDrawLines(ctx, cbSplitText(ctx, cert, ctx.contentW - 3.5), { size: 7.5, color: CB_GRAY_600, lineHeight: 3.8 }, { indentX: 3.5 });
  }
  ctx.y += 2;
}

export async function buildCreativeBoldPagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const sidebarW = 62;
  const sidebarPad = 7;
  const mainPad = 8;
  const mainX = sidebarW;
  const contentX = mainX + mainPad;
  const contentW = CV_PDF_A4_WIDTH_MM - contentX - mainPad;
  const marginTop = 12;
  const marginBottom = 12;

  const ctx: CreativeBoldDirectPdfContext = {
    pdf,
    locale,
    labels: getCreativeBoldPdfLabels(locale),
    pageWidth: CV_PDF_A4_WIDTH_MM,
    pageHeight: CV_PDF_A4_HEIGHT_MM,
    sidebarW,
    sidebarPad,
    mainX,
    mainPad,
    contentX,
    contentW,
    marginTop,
    marginBottom,
    bottomSafeY: CV_PDF_A4_HEIGHT_MM - marginBottom,
    y: marginTop,
    pageIndex: 0,
  };

  cbDrawPage1Sidebar(ctx, cv, options.photoDataUrl ?? null);

  cbDrawSummary(ctx, cv.summary);
  cbDrawExperience(ctx, cv);

  const eduH = cbEducationHeight(ctx, cv);
  const certH = cbCertificationsHeight(ctx, cv);
  const lowerH = eduH + certH;
  const freshCap = cbFreshPageCapacity(ctx);
  if (lowerH > 0 && lowerH <= freshCap && ctx.y + lowerH > ctx.bottomSafeY) {
    cbAddPage(ctx);
  }

  cbDrawEducation(ctx, cv);
  cbDrawCertifications(ctx, cv);

  const output = pdf.output('blob');
  return output instanceof Blob ? output : new Blob([output], { type: 'application/pdf' });
}

export async function buildCreativeBoldPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  const photoDataUrl = await prepareCreativeBoldPdfPhotoDataUrl(cv);
  const blob = await buildCreativeBoldPagedPdfBlob(cv, locale, { photoDataUrl });
  if (!blob || blob.size === 0) throw new Error('Creative Bold PDF generation produced an empty Blob');
  return blob;
}

export async function exportCreativeBoldPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildCreativeBoldPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

// Canonical square + circular crop for the Creative Artistic PDF header photo.
// Used only as a fallback when cv.personal.photo (the user's own framed crop) is
// unavailable and we must derive a square crop from the raw originalPhoto instead.
function cropCreativeArtisticPdfPhoto(dataUrl: string, outputSize: number): Promise<string> {
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
      const sy = isPortrait ? -(scaledH - outputSize) * 0.32 : (outputSize - scaledH) / 2;
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, scaledW, scaledH);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function prepareCreativeArtisticPdfPhotoDataUrl(cv: CVData): Promise<string | null> {
  const showPhoto = cv.personal.photoEnabled !== undefined
    ? cv.personal.photoEnabled
    : cv.region !== 'US';
  if (!showPhoto) return null;

  const personalPhotos = cv.personal as CVData['personal'] & {
    originalPhoto?: string;
  };
  // Prefer cv.personal.photo — the circular crop the user already framed themselves
  // in the in-app photo cropper — matching the Creative Artistic DOCX export.
  // originalPhoto is only used as a fallback for the rare case a selected photo is
  // missing.
  const source = cv.personal.photo?.trim() || personalPhotos.originalPhoto?.trim();
  if (!source) return null;

  const prepared = await prepareCvPhotoForExport(source);
  if (!prepared?.dataUrl) return null;
  const decoded = await decodeImageForExport(prepared.dataUrl);
  if (!decoded) return null;

  try {
    return await cropCreativeArtisticPdfPhoto(prepared.dataUrl, 512);
  } catch {
    return prepared.dataUrl;
  }
}

export async function buildCreativeArtisticPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  const photoDataUrl = await prepareCreativeArtisticPdfPhotoDataUrl(cv);
  const blob = await buildCreativeArtisticPagedPdfBlob(cv, locale, { photoDataUrl });
  if (!blob || blob.size === 0) throw new Error('Creative Artistic PDF generation produced an empty Blob');
  return blob;
}

export async function exportCreativeArtisticPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildCreativeArtisticPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

type CreativeArtisticPdfWriter = InstanceType<typeof import('jspdf').jsPDF>;

type CreativeArtisticDirectPdfContext = {
  pdf: CreativeArtisticPdfWriter;
  locale: Locale;
  labels: ReturnType<typeof getCreativeArtisticPdfLabels>;
  pageWidth: number;
  pageHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  contentWidth: number;
  bottomSafeY: number;
  y: number;
  pageIndex: number;
};

type CreativeArtisticTextStyle = {
  size: number;
  color: [number, number, number];
  fontStyle?: 'normal' | 'bold' | 'italic';
  lineHeight: number;
};

const CA_HEADER_PURPLE: [number, number, number] = [124, 58, 237];
const CA_HEADER_MAGENTA: [number, number, number] = [192, 38, 211];
const CA_TITLE_LIGHT: [number, number, number] = [221, 214, 254];
const CA_CONTACT_LIGHT: [number, number, number] = [245, 208, 254];
const CA_WHITE: [number, number, number] = [255, 255, 255];
const CA_HEADING: [number, number, number] = [124, 58, 237];
const CA_TEXT: [number, number, number] = [17, 24, 39];
const CA_MUTED: [number, number, number] = [107, 114, 128];
const CA_MUTED2: [number, number, number] = [75, 85, 99];
const CA_ACCENT: [number, number, number] = [139, 92, 246];
const CA_BORDER_ACCENT: [number, number, number] = [221, 214, 254];
const CA_CHIP_BG: [number, number, number] = [245, 243, 255];
const CA_CHIP_TEXT: [number, number, number] = [109, 40, 217];
const CA_SKILLS_LANG_GAP_MM = 6;

function getCreativeArtisticPdfLabels(locale: Locale) {
  const t = translations[locale] ?? translations.en;
  return {
    summary: t.cv.summary,
    experience: t.cv.experience,
    education: t.cv.education,
    skills: t.cv.skills,
    languages: t.cv.languages,
    certifications: t.cv.certifications,
    present: t.cv.present,
    fathersName: t.cv.fathersName,
  };
}

function caDirectDateRange(start: string, end: string, present: boolean, presentLabel: string): string {
  return [start, present ? presentLabel : end].filter(Boolean).join(' - ');
}

function caSetTextStyle(ctx: CreativeArtisticDirectPdfContext, style: CreativeArtisticTextStyle): void {
  ctx.pdf.setFont('helvetica', style.fontStyle ?? 'normal');
  ctx.pdf.setFontSize(style.size);
  ctx.pdf.setTextColor(style.color[0], style.color[1], style.color[2]);
}

function caSplitText(ctx: CreativeArtisticDirectPdfContext, text: string, maxWidth = ctx.contentWidth): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const result = ctx.pdf.splitTextToSize(normalized, maxWidth);
  return Array.isArray(result) ? result.map(String) : [String(result)];
}

function caFreshPageCapacity(ctx: CreativeArtisticDirectPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

function caAddPage(ctx: CreativeArtisticDirectPdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
}

function caEnsureSpace(ctx: CreativeArtisticDirectPdfContext, heightNeeded: number): void {
  if (ctx.y + heightNeeded <= ctx.bottomSafeY) return;
  caAddPage(ctx);
}

function caMoveToFreshPageIfNeeded(ctx: CreativeArtisticDirectPdfContext, blockHeight: number): void {
  if (blockHeight > caFreshPageCapacity(ctx)) return;
  if (ctx.y + blockHeight > ctx.bottomSafeY) {
    caAddPage(ctx);
  }
}

function caSectionHeadingHeight(): number {
  return 7.2;
}

function caDrawSectionHeading(ctx: CreativeArtisticDirectPdfContext, label: string, x = ctx.marginLeft): void {
  caEnsureSpace(ctx, caSectionHeadingHeight());
  caSetTextStyle(ctx, { size: 9.2, color: CA_HEADING, fontStyle: 'bold', lineHeight: 4.0 });
  ctx.pdf.text(label, x, ctx.y);
  ctx.y += caSectionHeadingHeight();
}

function caDrawSectionHeadingAt(ctx: CreativeArtisticDirectPdfContext, label: string, x: number, y: number): number {
  caSetTextStyle(ctx, { size: 9.2, color: CA_HEADING, fontStyle: 'bold', lineHeight: 4.0 });
  ctx.pdf.text(label, x, y);
  return y + caSectionHeadingHeight();
}

function caDrawLines(
  ctx: CreativeArtisticDirectPdfContext,
  lines: string[],
  style: CreativeArtisticTextStyle,
  opts: { x?: number; indentX?: number } = {},
): void {
  caSetTextStyle(ctx, style);
  const x = opts.x ?? (ctx.marginLeft + (opts.indentX ?? 0));
  for (const line of lines) {
    caEnsureSpace(ctx, style.lineHeight);
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function caDrawLinesBlock(
  ctx: CreativeArtisticDirectPdfContext,
  lines: string[],
  style: CreativeArtisticTextStyle,
  opts: { x?: number } = {},
): void {
  if (!lines.length) return;
  const blockH = lines.length * style.lineHeight;
  caMoveToFreshPageIfNeeded(ctx, blockH);
  caSetTextStyle(ctx, style);
  const x = opts.x ?? ctx.marginLeft;
  for (const line of lines) {
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function caDrawHeader(ctx: CreativeArtisticDirectPdfContext, cv: CVData, photoDataUrl: string | null): void {
  const padX = ctx.marginLeft;
  const padY = 8;
  const photoSize = 26;
  const gap = 5;
  const textX = photoDataUrl ? padX + photoSize + gap : padX;
  const textW = ctx.pageWidth - textX - ctx.marginRight;

  const showPhoto = cv.personal.photoEnabled !== undefined
    ? cv.personal.photoEnabled
    : cv.region !== 'US';
  const region = regionSettings[cv.region];
  const contacts = [
    cv.personal.email,
    cv.personal.phone,
    region.showAddress ? cv.personal.address : '',
  ].filter(Boolean) as string[];

  let textStackH = 6;
  if (cv.personal.jobTitle) textStackH += 5;
  if (contacts.length > 0) textStackH += 5;
  if (cv.personal.fathersName) textStackH += 4;
  const headerH = Math.max(
    showPhoto && photoDataUrl ? photoSize + padY * 2 : padY * 2 + 6,
    textStackH + padY * 2,
  );

  // Gradient approximation: purple base + magenta overlay on right half
  ctx.pdf.setFillColor(CA_HEADER_PURPLE[0], CA_HEADER_PURPLE[1], CA_HEADER_PURPLE[2]);
  ctx.pdf.rect(0, 0, ctx.pageWidth, headerH, 'F');
  ctx.pdf.setFillColor(CA_HEADER_MAGENTA[0], CA_HEADER_MAGENTA[1], CA_HEADER_MAGENTA[2]);
  ctx.pdf.rect(ctx.pageWidth * 0.45, 0, ctx.pageWidth * 0.55, headerH, 'F');

  const contentMidY = headerH / 2;
  if (showPhoto && photoDataUrl) {
    const photoY = contentMidY - photoSize / 2;
    try {
      ctx.pdf.addImage(photoDataUrl, 'PNG', padX, photoY, photoSize, photoSize);
    } catch {
      try {
        ctx.pdf.addImage(photoDataUrl, 'JPEG', padX, photoY, photoSize, photoSize);
      } catch {
        // Keep export usable if jsPDF rejects an image data URL.
      }
    }
  }

  let ty = contentMidY - textStackH / 2 + 4;
  caSetTextStyle(ctx, { size: 16, color: CA_WHITE, fontStyle: 'bold', lineHeight: 6 });
  const nameLines = caSplitText(ctx, cv.personal.fullName || 'Your Name', textW);
  for (const line of nameLines) {
    ctx.pdf.text(line, textX, ty);
    ty += 5.5;
  }
  if (cv.personal.jobTitle) {
    caSetTextStyle(ctx, { size: 9.5, color: CA_TITLE_LIGHT, lineHeight: 4.2 });
    const titleLines = caSplitText(ctx, cv.personal.jobTitle, textW);
    for (const line of titleLines) {
      ctx.pdf.text(line, textX, ty);
      ty += 4.0;
    }
  }
  if (contacts.length > 0) {
    caSetTextStyle(ctx, { size: 7.2, color: CA_CONTACT_LIGHT, lineHeight: 3.5 });
    ctx.pdf.text(contacts.join('  •  '), textX, ty);
    ty += 4.0;
  }
  if (cv.personal.fathersName) {
    caSetTextStyle(ctx, { size: 7.2, color: CA_CONTACT_LIGHT, lineHeight: 3.5 });
    ctx.pdf.text(`${ctx.labels.fathersName}: ${cv.personal.fathersName}`, textX, ty);
  }

  ctx.y = headerH + 6;
}

function caDrawSummary(ctx: CreativeArtisticDirectPdfContext, summary: string): void {
  const blocks = splitCleanSimpleSummaryParagraphBlocks(summary);
  if (!blocks.length) return;
  caEnsureSpace(ctx, caSectionHeadingHeight());
  caDrawSectionHeading(ctx, ctx.labels.summary);
  const style: CreativeArtisticTextStyle = { size: 8.1, color: CA_MUTED2, lineHeight: 4.0 };
  blocks.forEach((block, i) => {
    caDrawLines(ctx, caSplitText(ctx, block), style);
    if (i < blocks.length - 1) ctx.y += 2.5;
  });
  ctx.y += 4;
}

function caExperienceTextX(ctx: CreativeArtisticDirectPdfContext): number {
  return ctx.marginLeft + 3.5;
}

function caExperienceTextW(ctx: CreativeArtisticDirectPdfContext): number {
  return ctx.contentWidth - 3.5;
}

function caExperienceDescriptionParts(
  ctx: CreativeArtisticDirectPdfContext,
  entry: CVData['experience'][number],
): Array<{ isBullet: boolean; lines: string[] }> {
  const textW = caExperienceTextW(ctx);
  return entry.description
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map((part) => {
      const cleaned = part.replace(/^(?:[-•*]|\d+\.)\s+/, '');
      const isBullet = cleaned !== part;
      return { isBullet, lines: caSplitText(ctx, cleaned, textW - (isBullet ? 3.5 : 0)) };
    });
}

function caExperienceLeadBlockHeight(ctx: CreativeArtisticDirectPdfContext, entry: CVData['experience'][number]): number {
  const textW = caExperienceTextW(ctx);
  const titleLines = caSplitText(ctx, entry.position, textW);
  const headerH = Math.max(4.0, titleLines.length * 4.0)
    + ((entry.company || entry.startDate) ? 3.5 : 0)
    + 1.5;
  const parts = caExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(p => p.isBullet);
  const leadParts = (bulletParts.length ? bulletParts : parts).slice(0, 2);
  return headerH + leadParts.reduce((sum, p) => sum + p.lines.length * 3.8, 0);
}

function caExperienceEntryHeight(ctx: CreativeArtisticDirectPdfContext, entry: CVData['experience'][number]): number {
  const parts = caExperienceDescriptionParts(ctx, entry);
  const textW = caExperienceTextW(ctx);
  const titleLines = caSplitText(ctx, entry.position, textW);
  const headerH = Math.max(4.0, titleLines.length * 4.0)
    + ((entry.company || entry.startDate) ? 3.5 : 0)
    + 1.5;
  return headerH + parts.reduce((sum, p) => sum + p.lines.length * 3.8, 0) + 3;
}

function caDrawWrappedBulletAtomic(
  ctx: CreativeArtisticDirectPdfContext,
  part: { isBullet: boolean; lines: string[] },
  textX: number,
): void {
  if (!part.lines.length) return;
  const blockH = part.lines.length * 3.8;
  caMoveToFreshPageIfNeeded(ctx, blockH);
  caSetTextStyle(ctx, { size: 7.6, color: CA_MUTED2, lineHeight: 3.8 });
  if (part.isBullet) ctx.pdf.text('•', textX, ctx.y);
  for (const line of part.lines) {
    ctx.pdf.text(line, textX + (part.isBullet ? 3.5 : 0), ctx.y);
    ctx.y += 3.8;
  }
}

function caDrawExperienceEntryPaginated(ctx: CreativeArtisticDirectPdfContext, entry: CVData['experience'][number]): void {
  const dateText = caDirectDateRange(entry.startDate, entry.endDate, entry.isPresent, ctx.labels.present);
  const accentX = ctx.marginLeft;
  const textX = caExperienceTextX(ctx);
  const textW = caExperienceTextW(ctx);
  const leadH = caExperienceLeadBlockHeight(ctx, entry);
  const fullH = caExperienceEntryHeight(ctx, entry);
  const remainingSpace = ctx.bottomSafeY - ctx.y;
  const freshCap = caFreshPageCapacity(ctx);

  const drawHeader = () => {
    const titleLines = caSplitText(ctx, entry.position, textW);
    caDrawLinesBlock(ctx, titleLines, { size: 8.2, color: CA_TEXT, fontStyle: 'bold', lineHeight: 4.0 }, { x: textX });
    if (entry.company || dateText) {
      const meta = [entry.company, dateText].filter(Boolean).join(' | ');
      caDrawLinesBlock(ctx, caSplitText(ctx, meta, textW), { size: 7.2, color: CA_ACCENT, lineHeight: 3.5 }, { x: textX });
    }
    ctx.y += 1.5;
  };

  const drawParts = (parts: Array<{ isBullet: boolean; lines: string[] }>) => {
    for (const part of parts) {
      if (!part.lines.length) continue;
      if (part.isBullet || part.lines.length === 1) {
        caDrawWrappedBulletAtomic(ctx, part, textX);
        continue;
      }
      caSetTextStyle(ctx, { size: 7.6, color: CA_MUTED2, lineHeight: 3.8 });
      for (const line of part.lines) {
        caDrawWrappedBulletAtomic(ctx, { isBullet: false, lines: [line] }, textX);
      }
    }
  };

  if (fullH <= remainingSpace) {
    const startY = ctx.y;
    drawHeader();
    drawParts(caExperienceDescriptionParts(ctx, entry));
    ctx.pdf.setDrawColor(CA_BORDER_ACCENT[0], CA_BORDER_ACCENT[1], CA_BORDER_ACCENT[2]);
    ctx.pdf.setLineWidth(0.8);
    ctx.pdf.line(accentX, startY - 1, accentX, ctx.y);
    ctx.y += 3;
    return;
  }

  if (leadH > remainingSpace && leadH <= freshCap) {
    caAddPage(ctx);
  }

  const startY = ctx.y;
  drawHeader();
  const parts = caExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(p => p.isBullet);
  const useGrouped = bulletParts.length > 0;
  const leadParts = (useGrouped ? bulletParts : parts).slice(0, 2);
  const tailParts = (useGrouped ? bulletParts : parts).slice(leadParts.length);
  const nonBulletParts = useGrouped ? parts.filter(p => !p.isBullet) : [];

  for (const part of leadParts) caDrawWrappedBulletAtomic(ctx, part, textX);
  ctx.pdf.setDrawColor(CA_BORDER_ACCENT[0], CA_BORDER_ACCENT[1], CA_BORDER_ACCENT[2]);
  ctx.pdf.setLineWidth(0.8);
  ctx.pdf.line(accentX, startY - 1, accentX, ctx.y);

  for (const part of nonBulletParts) caDrawWrappedBulletAtomic(ctx, part, textX);

  let continuationShown = false;
  let tailStartY = ctx.y;
  for (const part of tailParts) {
    const partH = part.lines.length * 3.8;
    if (ctx.y + partH > ctx.bottomSafeY) {
      caAddPage(ctx);
      if (!continuationShown) {
        caSetTextStyle(ctx, { size: 7.5, color: CA_TEXT, fontStyle: 'italic', lineHeight: 3.8 });
        ctx.pdf.text(`${entry.position} (continued)`, textX, ctx.y);
        ctx.y += 4.2;
        continuationShown = true;
      }
      tailStartY = ctx.y;
    }
    caDrawWrappedBulletAtomic(ctx, part, textX);
    ctx.pdf.setDrawColor(CA_BORDER_ACCENT[0], CA_BORDER_ACCENT[1], CA_BORDER_ACCENT[2]);
    ctx.pdf.setLineWidth(0.8);
    ctx.pdf.line(accentX, tailStartY - 1, accentX, ctx.y);
    tailStartY = ctx.y;
  }
  ctx.y += 3;
}

function caDrawExperience(ctx: CreativeArtisticDirectPdfContext, cv: CVData): void {
  if (!cv.experience.length) return;
  const leadH = caSectionHeadingHeight() + caExperienceLeadBlockHeight(ctx, cv.experience[0]);
  caMoveToFreshPageIfNeeded(ctx, leadH);
  caDrawSectionHeading(ctx, ctx.labels.experience);
  for (const entry of cv.experience) {
    caDrawExperienceEntryPaginated(ctx, entry);
  }
}

function caEducationEntryHeight(ctx: CreativeArtisticDirectPdfContext, edu: CVData['education'][number]): number {
  const degreeLines = caSplitText(ctx, edu.degree);
  const degreeH = Math.max(4.0, degreeLines.length * 4.0);
  const metaH = (edu.school || edu.startDate || edu.endDate) ? 3.5 : 0;
  return degreeH + metaH + 2.5;
}

function caEducationHeight(ctx: CreativeArtisticDirectPdfContext, cv: CVData): number {
  if (!cv.education.length) return 0;
  let h = caSectionHeadingHeight();
  for (const edu of cv.education) h += caEducationEntryHeight(ctx, edu);
  return h + 2;
}

function caDrawEducationEntry(ctx: CreativeArtisticDirectPdfContext, edu: CVData['education'][number]): void {
  const entryH = caEducationEntryHeight(ctx, edu);
  caMoveToFreshPageIfNeeded(ctx, entryH);
  caDrawLinesBlock(ctx, caSplitText(ctx, edu.degree), { size: 8.2, color: CA_TEXT, fontStyle: 'bold', lineHeight: 4.0 });
  const dateParts = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
  const metaText = [edu.school, dateParts].filter(Boolean).join(' | ');
  if (metaText) {
    caDrawLinesBlock(ctx, caSplitText(ctx, metaText), { size: 7.2, color: CA_MUTED, lineHeight: 3.5 });
  }
  ctx.y += 2.5;
}

function caDrawEducation(ctx: CreativeArtisticDirectPdfContext, cv: CVData): void {
  if (!cv.education.length) return;
  const fullH = caEducationHeight(ctx, cv);
  const headingPlusFirst = caSectionHeadingHeight() + caEducationEntryHeight(ctx, cv.education[0]);
  const freshCap = caFreshPageCapacity(ctx);
  if (fullH <= freshCap) {
    caMoveToFreshPageIfNeeded(ctx, fullH);
  } else {
    caMoveToFreshPageIfNeeded(ctx, headingPlusFirst);
  }
  caDrawSectionHeading(ctx, ctx.labels.education);
  for (const edu of cv.education) caDrawEducationEntry(ctx, edu);
  ctx.y += 2;
}

type CaSkillChipLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
};

function caMeasureSkillChip(
  ctx: CreativeArtisticDirectPdfContext,
  label: string,
  maxColWidth: number,
): { width: number; height: number; lines: string[] } {
  const padH = 2.1;
  const padV = 0.85;
  const lineH = 3.4;
  caSetTextStyle(ctx, { size: 7.2, color: CA_CHIP_TEXT, lineHeight: lineH });
  const textWidth = ctx.pdf.getTextWidth(label);
  const singleLineWidth = textWidth + padH * 2;
  if (singleLineWidth <= maxColWidth) {
    return { width: singleLineWidth, height: lineH + padV * 2, lines: [label] };
  }
  const lines = caSplitText(ctx, label, maxColWidth - padH * 2);
  return { width: maxColWidth, height: lines.length * lineH + padV * 2, lines };
}

function caLayoutSkillChips(
  ctx: CreativeArtisticDirectPdfContext,
  skills: string[],
  maxColWidth: number,
): { chips: CaSkillChipLayout[]; totalHeight: number } {
  const gapX = 1.1;
  const gapY = 1.1;
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  const chips: CaSkillChipLayout[] = [];
  for (const skill of skills) {
    const measured = caMeasureSkillChip(ctx, skill, maxColWidth);
    if (cursorX > 0 && cursorX + measured.width > maxColWidth) {
      cursorY += rowHeight + gapY;
      cursorX = 0;
      rowHeight = 0;
    }
    chips.push({ x: cursorX, y: cursorY, width: measured.width, height: measured.height, lines: measured.lines });
    cursorX += measured.width + gapX;
    rowHeight = Math.max(rowHeight, measured.height);
  }
  return { chips, totalHeight: cursorY + rowHeight };
}

function caMeasureSkillChipsHeight(ctx: CreativeArtisticDirectPdfContext, skills: string[], maxColWidth: number): number {
  if (!skills.length) return 0;
  return caLayoutSkillChips(ctx, skills, maxColWidth).totalHeight;
}

function caDrawSkillChips(
  ctx: CreativeArtisticDirectPdfContext,
  skills: string[],
  colX: number,
  colY: number,
  maxColWidth: number,
): number {
  const layout = caLayoutSkillChips(ctx, skills, maxColWidth);
  const padH = 2.1;
  const padV = 0.85;
  const lineH = 3.4;
  for (const chip of layout.chips) {
    const chipX = colX + chip.x;
    const chipY = colY + chip.y;
    ctx.pdf.setFillColor(CA_CHIP_BG[0], CA_CHIP_BG[1], CA_CHIP_BG[2]);
    ctx.pdf.rect(chipX, chipY - padV - lineH + 1.2, chip.width, chip.height, 'F');
    caSetTextStyle(ctx, { size: 7.2, color: CA_CHIP_TEXT, lineHeight: lineH });
    chip.lines.forEach((line, lineIndex) => {
      ctx.pdf.text(line, chipX + padH, chipY + lineIndex * lineH);
    });
  }
  return layout.totalHeight;
}

function caSkillsLanguagesHeight(ctx: CreativeArtisticDirectPdfContext, cv: CVData): number {
  const skills = cv.skills.map(s => getLocalizedCvSkillName(s, ctx.locale));
  const hasSkills = skills.length > 0;
  const hasLangs = cv.languages.length > 0;
  if (!hasSkills && !hasLangs) return 0;

  const colW = (ctx.contentWidth - CA_SKILLS_LANG_GAP_MM) / 2;
  let skillsH = 0;
  let langsH = 0;
  if (hasSkills) {
    skillsH = caSectionHeadingHeight() + caMeasureSkillChipsHeight(ctx, skills, colW);
  }
  if (hasLangs) {
    langsH = caSectionHeadingHeight() + cv.languages.length * 3.8;
  }
  return Math.max(skillsH, langsH) + 2;
}

function caDrawSkillsLanguagesBlock(ctx: CreativeArtisticDirectPdfContext, cv: CVData): void {
  const skills = cv.skills.map(s => getLocalizedCvSkillName(s, ctx.locale));
  const hasSkills = skills.length > 0;
  const hasLangs = cv.languages.length > 0;
  if (!hasSkills && !hasLangs) return;

  const blockH = caSkillsLanguagesHeight(ctx, cv);
  caMoveToFreshPageIfNeeded(ctx, blockH);

  const colW = (ctx.contentWidth - CA_SKILLS_LANG_GAP_MM) / 2;
  const skillsX = ctx.marginLeft;
  const langsX = ctx.marginLeft + colW + CA_SKILLS_LANG_GAP_MM;
  const blockTopY = ctx.y;
  let skillsBottom = blockTopY;
  let langsBottom = blockTopY;

  if (hasSkills) {
    const headingEnd = caDrawSectionHeadingAt(ctx, ctx.labels.skills, skillsX, blockTopY);
    const chipsH = caDrawSkillChips(ctx, skills, skillsX, headingEnd, colW);
    skillsBottom = headingEnd + chipsH;
  }

  if (hasLangs) {
    const headingEnd = caDrawSectionHeadingAt(ctx, ctx.labels.languages, langsX, blockTopY);
    caSetTextStyle(ctx, { size: 7.6, color: CA_TEXT, lineHeight: 3.8 });
    let langY = headingEnd;
    for (const lang of cv.languages) {
      ctx.pdf.text(
        `${getLocalizedCvLanguageName(lang.name, ctx.locale)} - ${lang.level}`,
        langsX,
        langY,
      );
      langY += 3.8;
    }
    langsBottom = langY;
  }

  ctx.y = Math.max(skillsBottom, langsBottom) + 2;
}

function caCertificationsHeight(ctx: CreativeArtisticDirectPdfContext, cv: CVData): number {
  if (!cv.certifications.length) return 0;
  let h = caSectionHeadingHeight();
  for (const cert of cv.certifications) {
    h += caSplitText(ctx, cert).length * 3.8 + 1;
  }
  return h;
}

function caDrawCertifications(ctx: CreativeArtisticDirectPdfContext, cv: CVData): void {
  if (!cv.certifications.length) return;
  caMoveToFreshPageIfNeeded(ctx, caSectionHeadingHeight() + 6);
  caDrawSectionHeading(ctx, ctx.labels.certifications);
  for (const cert of cv.certifications) {
    caDrawLines(ctx, caSplitText(ctx, cert), { size: 7.6, color: CA_MUTED2, lineHeight: 3.8 });
  }
  ctx.y += 2;
}

function caMoveLowerSectionsIfNeeded(
  ctx: CreativeArtisticDirectPdfContext,
  educationH: number,
  skillsLangH: number,
  certsH: number,
): void {
  const lowerH = educationH + skillsLangH + certsH;
  if (lowerH <= 0) return;
  const freshCap = caFreshPageCapacity(ctx);
  const remaining = ctx.bottomSafeY - ctx.y;

  if (lowerH <= remaining) return;

  if (lowerH <= freshCap) {
    caAddPage(ctx);
    return;
  }

  const eduSkillsLangH = educationH + skillsLangH;
  if (eduSkillsLangH > 0 && eduSkillsLangH <= freshCap && eduSkillsLangH > remaining) {
    caAddPage(ctx);
  }
}

export async function buildCreativeArtisticPagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginLeft = 10;
  const marginRight = 10;
  const marginTop = 10;
  const marginBottom = 12;
  const ctx: CreativeArtisticDirectPdfContext = {
    pdf,
    locale,
    labels: getCreativeArtisticPdfLabels(locale),
    pageWidth: CV_PDF_A4_WIDTH_MM,
    pageHeight: CV_PDF_A4_HEIGHT_MM,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    contentWidth: CV_PDF_A4_WIDTH_MM - marginLeft - marginRight,
    bottomSafeY: CV_PDF_A4_HEIGHT_MM - marginBottom,
    y: 0,
    pageIndex: 0,
  };

  caDrawHeader(ctx, cv, options.photoDataUrl ?? null);
  caDrawSummary(ctx, cv.summary);
  caDrawExperience(ctx, cv);

  const educationH = caEducationHeight(ctx, cv);
  const skillsLangH = caSkillsLanguagesHeight(ctx, cv);
  const certsH = caCertificationsHeight(ctx, cv);
  caMoveLowerSectionsIfNeeded(ctx, educationH, skillsLangH, certsH);

  if (educationH > 0) caDrawEducation(ctx, cv);

  if (skillsLangH > 0) {
    const blockH = caSkillsLanguagesHeight(ctx, cv);
    const freshCap = caFreshPageCapacity(ctx);
    if (blockH <= freshCap) {
      caMoveToFreshPageIfNeeded(ctx, blockH);
    } else {
      const skillsOnlyH = caSectionHeadingHeight() + caMeasureSkillChipsHeight(
        ctx,
        cv.skills.map(s => getLocalizedCvSkillName(s, ctx.locale)),
        (ctx.contentWidth - CA_SKILLS_LANG_GAP_MM) / 2,
      );
      caMoveToFreshPageIfNeeded(ctx, skillsOnlyH);
    }
    caDrawSkillsLanguagesBlock(ctx, cv);
  }

  if (certsH > 0) caDrawCertifications(ctx, cv);

  const output = pdf.output('blob');
  return output instanceof Blob ? output : new Blob([output], { type: 'application/pdf' });
}

function createRirekishoPortraitPhoto(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      try {
        if (typeof img.decode === 'function') await img.decode().catch(() => undefined);
        const sourceWidth = img.naturalWidth || img.width;
        const sourceHeight = img.naturalHeight || img.height;
        if (sourceWidth <= 0 || sourceHeight <= 0) {
          resolve(null);
          return;
        }

        const targetWidth = 270;
        const targetHeight = 360;
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
        const scaledWidth = sourceWidth * scale;
        const scaledHeight = sourceHeight * scale;
        const dx = (targetWidth - scaledWidth) / 2;
        const dy = (targetHeight - scaledHeight) / 2;
        ctx.drawImage(img, dx, dy, scaledWidth, scaledHeight);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function prepareRirekishoPdfPhotoDataUrl(cv: CVData): Promise<RirekishoCanonicalPhotoResult | null> {
  const showPhoto = cv.personal.photoEnabled !== undefined ? cv.personal.photoEnabled : true;
  if (!showPhoto) return null;

  const personalPhotos = cv.personal as CVData['personal'] & {
    originalPhoto?: string;
  };
  const original = personalPhotos.originalPhoto?.trim();
  const selected = cv.personal.photo?.trim();
  const source = original || selected || '';
  if (!source) return null;

  const prepared = await prepareCvPhotoForExport(source);
  if (!prepared?.dataUrl) return null;
  const portraitDataUrl = await createRirekishoPortraitPhoto(prepared.dataUrl);
  if (!portraitDataUrl) return null;
  const decoded = await decodeImageForExport(portraitDataUrl);
  if (!decoded) return null;

  return {
    dataUrl: portraitDataUrl,
    bytes: dataUrlToBytes(portraitDataUrl),
    mimeType: 'image/jpeg',
    width: 270,
    height: 360,
    source: original ? 'original-photo' : 'selected-photo',
  };
}

export async function buildRirekishoPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Rirekisho PDF export requires a browser DOM');
  }

  const canonicalPhoto = await prepareRirekishoPdfPhotoDataUrl(cv);
  const container = document.createElement('div');
  container.id = `rirekisho-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-rirekisho-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createRirekishoPdfTemplate(cv, {
    locale,
    photoDataUrl: canonicalPhoto?.dataUrl ?? null,
  }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('Rirekisho PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
}

export async function exportRirekishoPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildRirekishoPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

async function prepareTechSidebarPdfPhotoDataUrl(cv: CVData): Promise<TechSidebarCanonicalPhotoResult | null> {
  const showPhoto = cv.personal.photoEnabled !== undefined
    ? cv.personal.photoEnabled
    : cv.region !== 'US';
  if (!showPhoto) return null;

  const personalPhotos = cv.personal as CVData['personal'] & {
    originalPhoto?: string;
  };
  const original = personalPhotos.originalPhoto?.trim();
  const selected = cv.personal.photo?.trim();
  const source = original || selected || '';
  if (!source) return null;

  const prepared = await prepareCvPhotoForExport(source);
  if (!prepared?.dataUrl) return null;
  const squareDataUrl = await createNordicCleanSquarePhoto(prepared.dataUrl);
  const decoded = await decodeImageForExport(squareDataUrl);
  if (!decoded) return null;
  return {
    dataUrl: squareDataUrl,
    bytes: dataUrlToBytes(squareDataUrl),
    mimeType: 'image/jpeg',
    width: 164,
    height: 164,
    source: original ? 'original-photo' : 'selected-photo',
  };
}

export async function buildTechSidebarPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Tech Sidebar PDF export requires a browser DOM');
  }

  const canonicalPhoto = await prepareTechSidebarPdfPhotoDataUrl(cv);
  const container = document.createElement('div');
  container.id = `tech-sidebar-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-tech-sidebar-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createTechSidebarPdfTemplate(cv, {
    locale,
    photoDataUrl: canonicalPhoto?.dataUrl ?? null,
  }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('Tech Sidebar PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
}

export async function exportTechSidebarPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildTechSidebarPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

async function prepareCorporateNavyPdfPhotoDataUrl(cv: CVData): Promise<CorporateNavyCanonicalPhotoResult | null> {
  const showPhoto = cv.personal.photoEnabled !== undefined
    ? cv.personal.photoEnabled
    : cv.region !== 'US';
  if (!showPhoto) return null;

  const personalPhotos = cv.personal as CVData['personal'] & {
    originalPhoto?: string;
  };
  const original = personalPhotos.originalPhoto?.trim();
  const selected = cv.personal.photo?.trim();
  const source = original || selected || '';
  if (!source) return null;

  const prepared = await prepareCvPhotoForExport(source);
  if (!prepared?.dataUrl) return null;
  const squareDataUrl = await createNordicCleanSquarePhoto(prepared.dataUrl);
  const decoded = await decodeImageForExport(squareDataUrl);
  if (!decoded) return null;
  return {
    dataUrl: squareDataUrl,
    bytes: dataUrlToBytes(squareDataUrl),
    mimeType: 'image/jpeg',
    width: 164,
    height: 164,
    source: original ? 'original-photo' : 'selected-photo',
  };
}

export async function buildCorporateNavyPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Corporate Navy PDF export requires a browser DOM');
  }

  const canonicalPhoto = await prepareCorporateNavyPdfPhotoDataUrl(cv);
  const container = document.createElement('div');
  container.id = `corporate-navy-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-corporate-navy-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createCorporateNavyPdfTemplate(cv, {
    locale,
    photoDataUrl: canonicalPhoto?.dataUrl ?? null,
  }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('Corporate Navy PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
}

export async function exportCorporateNavyPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildCorporateNavyPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

async function prepareContemporaryBoldPdfPhotoDataUrl(cv: CVData): Promise<ContemporaryBoldCanonicalPhotoResult | null> {
  const showPhoto = cv.personal.photoEnabled !== undefined
    ? cv.personal.photoEnabled
    : cv.region !== 'US';
  if (!showPhoto) return null;

  const personalPhotos = cv.personal as CVData['personal'] & {
    originalPhoto?: string;
  };
  const original = personalPhotos.originalPhoto?.trim();
  const selected = cv.personal.photo?.trim();
  const source = original || selected || '';
  if (!source) return null;

  const prepared = await prepareCvPhotoForExport(source);
  if (!prepared?.dataUrl) return null;
  const squareDataUrl = await createNordicCleanSquarePhoto(prepared.dataUrl);
  const decoded = await decodeImageForExport(squareDataUrl);
  if (!decoded) return null;
  return {
    dataUrl: squareDataUrl,
    bytes: dataUrlToBytes(squareDataUrl),
    mimeType: 'image/jpeg',
    width: 164,
    height: 164,
    source: original ? 'original-photo' : 'selected-photo',
  };
}

export async function buildContemporaryBoldPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Contemporary Bold PDF export requires a browser DOM');
  }

  const canonicalPhoto = await prepareContemporaryBoldPdfPhotoDataUrl(cv);
  const container = document.createElement('div');
  container.id = `contemporary-bold-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-contemporary-bold-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createContemporaryBoldPdfTemplate(cv, {
    locale,
    photoDataUrl: canonicalPhoto?.dataUrl ?? null,
  }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('Contemporary Bold PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
}

export async function exportContemporaryBoldPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildContemporaryBoldPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

async function awaitExportTemplateImages(root: HTMLElement): Promise<void> {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>('img'));
  await Promise.all(images.map(async (img) => {
    if (typeof img.decode === 'function') {
      await img.decode().catch(() => undefined);
      return;
    }
    if (img.complete) return;
    if (img.src.startsWith('data:')) {
      await new Promise(resolve => setTimeout(resolve, 0));
      return;
    }
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  }));
}

type ElegantFormalPdfWriter = InstanceType<typeof import('jspdf').jsPDF>;

type ElegantFormalDirectPdfContext = {
  pdf: ElegantFormalPdfWriter;
  locale: Locale;
  labels: ReturnType<typeof getElegantFormalPdfLabels>;
  pageWidth: number;
  pageHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  contentWidth: number;
  bottomSafeY: number;
  y: number;
  pageIndex: number;
};

type ElegantFormalTextStyle = {
  size: number;
  color: [number, number, number];
  fontStyle?: 'normal' | 'bold' | 'italic';
  lineHeight: number;
};

const EF_AMBER: [number, number, number] = [180, 83, 9];
const EF_TEXT: [number, number, number] = [17, 24, 39];
const EF_NAME: [number, number, number] = [31, 41, 55];
const EF_SUMMARY: [number, number, number] = [55, 65, 81];
const EF_MUTED: [number, number, number] = [75, 85, 99];
const EF_LIGHT: [number, number, number] = [156, 163, 175];
const EF_EDU_META: [number, number, number] = [107, 114, 128];
const EF_RULE: [number, number, number] = [229, 231, 235];
const EF_SEPARATOR: [number, number, number] = [209, 213, 219];
const EF_PHOTO_W_MM = 21.7;
const EF_PHOTO_H_MM = 28.9;
const EF_HEADER_GAP_MM = 4.8;
const EF_LOWER_COL_GAP_MM = 3.7;

function getElegantFormalPdfLabels(locale: Locale) {
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

function efSetTextStyle(ctx: ElegantFormalDirectPdfContext, style: ElegantFormalTextStyle): void {
  ctx.pdf.setFont('times', style.fontStyle ?? 'normal');
  ctx.pdf.setFontSize(style.size);
  ctx.pdf.setTextColor(style.color[0], style.color[1], style.color[2]);
}

function efSplitText(ctx: ElegantFormalDirectPdfContext, text: string, maxWidth = ctx.contentWidth): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const result = ctx.pdf.splitTextToSize(normalized, maxWidth);
  return Array.isArray(result) ? result.map(String) : [String(result)];
}

function efFreshPageCapacity(ctx: ElegantFormalDirectPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

function efAddPage(ctx: ElegantFormalDirectPdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
}

function efEnsureSpace(ctx: ElegantFormalDirectPdfContext, heightNeeded: number): void {
  if (ctx.y + heightNeeded <= ctx.bottomSafeY) return;
  efAddPage(ctx);
}

function efMoveToFreshPageIfNeeded(ctx: ElegantFormalDirectPdfContext, blockHeight: number): void {
  if (blockHeight > efFreshPageCapacity(ctx)) return;
  if (ctx.y + blockHeight > ctx.bottomSafeY) {
    efAddPage(ctx);
  }
}

function efCenteredX(ctx: ElegantFormalDirectPdfContext, text: string): number {
  return (ctx.pageWidth - ctx.pdf.getTextWidth(text)) / 2;
}

function efCenteredXInColumn(ctx: ElegantFormalDirectPdfContext, text: string, colX: number, colW: number): number {
  return colX + (colW - ctx.pdf.getTextWidth(text)) / 2;
}

function efSectionHeadingHeight(withRule = false): number {
  return withRule ? 8.2 : 6.2;
}

function efDrawSectionHeading(ctx: ElegantFormalDirectPdfContext, label: string, withRule = false): void {
  const blockH = efSectionHeadingHeight(withRule);
  efEnsureSpace(ctx, blockH);
  const upper = label.toUpperCase();
  efSetTextStyle(ctx, { size: 9, color: EF_AMBER, fontStyle: 'bold', lineHeight: 4.0 });
  ctx.pdf.text(upper, efCenteredX(ctx, upper), ctx.y);
  ctx.y += 4.8;
  if (withRule) {
    ctx.pdf.setDrawColor(EF_RULE[0], EF_RULE[1], EF_RULE[2]);
    ctx.pdf.setLineWidth(0.25);
    ctx.pdf.line(ctx.marginLeft, ctx.y, ctx.pageWidth - ctx.marginRight, ctx.y);
    ctx.y += 2.4;
  }
}

function efDrawSectionHeadingAt(
  ctx: ElegantFormalDirectPdfContext,
  label: string,
  colX: number,
  colW: number,
  y: number,
): number {
  const upper = label.toUpperCase();
  efSetTextStyle(ctx, { size: 9, color: EF_AMBER, fontStyle: 'bold', lineHeight: 4.0 });
  ctx.pdf.text(upper, efCenteredXInColumn(ctx, upper, colX, colW), y);
  return y + 5.2;
}

function efDrawCenteredLines(
  ctx: ElegantFormalDirectPdfContext,
  lines: string[],
  style: ElegantFormalTextStyle,
): void {
  if (!lines.length) return;
  efSetTextStyle(ctx, style);
  for (const line of lines) {
    efEnsureSpace(ctx, style.lineHeight);
    ctx.pdf.text(line, efCenteredX(ctx, line), ctx.y);
    ctx.y += style.lineHeight;
  }
}

function efDrawLinesBlock(
  ctx: ElegantFormalDirectPdfContext,
  lines: string[],
  style: ElegantFormalTextStyle,
  opts: { x?: number } = {},
): void {
  if (!lines.length) return;
  const blockH = lines.length * style.lineHeight;
  efMoveToFreshPageIfNeeded(ctx, blockH);
  efSetTextStyle(ctx, style);
  const x = opts.x ?? ctx.marginLeft;
  for (const line of lines) {
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function efDirectDateRange(start: string, end: string, present: boolean, presentLabel: string): string {
  return [start, present ? presentLabel : end].filter(Boolean).join(' - ');
}

function efHasPhotoEnabled(cv: CVData): boolean {
  if (cv.personal.photoEnabled !== undefined) return cv.personal.photoEnabled;
  return cv.region !== 'US';
}

function efDrawHeader(ctx: ElegantFormalDirectPdfContext, cv: CVData, photoDataUrl: string | null): void {
  const region = regionSettings[cv.region];
  const contacts = [
    cv.personal.email,
    cv.personal.phone,
    region.showAddress ? cv.personal.address : '',
  ].filter(Boolean) as string[];
  const showPhoto = Boolean(photoDataUrl && efHasPhotoEnabled(cv));
  const headerTop = ctx.marginTop;
  let headerBottom = headerTop;

  if (showPhoto && photoDataUrl) {
    try {
      ctx.pdf.addImage(photoDataUrl, 'JPEG', ctx.marginLeft, headerTop, EF_PHOTO_W_MM, EF_PHOTO_H_MM);
    } catch {
      try {
        ctx.pdf.addImage(photoDataUrl, 'PNG', ctx.marginLeft, headerTop, EF_PHOTO_W_MM, EF_PHOTO_H_MM);
      } catch {
        // Keep export usable if jsPDF rejects an image data URL.
      }
    }
    headerBottom = Math.max(headerBottom, headerTop + EF_PHOTO_H_MM);
  }

  const centerColX = showPhoto
    ? ctx.marginLeft + EF_PHOTO_W_MM + EF_HEADER_GAP_MM
    : ctx.marginLeft;
  const centerColW = showPhoto
    ? ctx.contentWidth - EF_PHOTO_W_MM - EF_HEADER_GAP_MM - EF_PHOTO_W_MM
    : ctx.contentWidth;
  const centerOfCol = (text: string) => centerColX + (centerColW - ctx.pdf.getTextWidth(text)) / 2;

  let textY = headerTop + 4;
  efSetTextStyle(ctx, { size: 22, color: EF_NAME, fontStyle: 'normal', lineHeight: 5.5 });
  for (const line of efSplitText(ctx, cv.personal.fullName || 'Your Name', centerColW)) {
    ctx.pdf.text(line, centerOfCol(line), textY);
    textY += 5.2;
  }

  if (cv.personal.jobTitle) {
    efSetTextStyle(ctx, { size: 9, color: EF_AMBER, fontStyle: 'bold', lineHeight: 4.0 });
    const title = cv.personal.jobTitle.toUpperCase();
    for (const line of efSplitText(ctx, title, centerColW)) {
      ctx.pdf.text(line, centerOfCol(line), textY);
      textY += 3.8;
    }
  }

  if (contacts.length > 0) {
    textY += 1.5;
    efSetTextStyle(ctx, { size: 9, color: EF_LIGHT, fontStyle: 'normal', lineHeight: 3.5 });
    const contactParts: string[] = [];
    contacts.forEach((contact, index) => {
      if (index > 0) contactParts.push(' | ');
      contactParts.push(contact);
    });
    const contactLine = contactParts.join('');
    for (const line of efSplitText(ctx, contactLine, centerColW)) {
      ctx.pdf.text(line, centerOfCol(line), textY);
      textY += 3.5;
    }
  }

  headerBottom = Math.max(headerBottom, textY);
  ctx.y = headerBottom + 3.5;
  ctx.pdf.setDrawColor(EF_SEPARATOR[0], EF_SEPARATOR[1], EF_SEPARATOR[2]);
  ctx.pdf.setLineWidth(0.3);
  ctx.pdf.line(ctx.marginLeft, ctx.y, ctx.pageWidth - ctx.marginRight, ctx.y);
  ctx.y += 4.5;
}

function efDrawSummary(ctx: ElegantFormalDirectPdfContext, summary: string): void {
  const blocks = splitCleanSimpleSummaryParagraphBlocks(summary);
  if (!blocks.length) return;
  efEnsureSpace(ctx, efSectionHeadingHeight());
  efDrawSectionHeading(ctx, ctx.labels.summary);
  const style: ElegantFormalTextStyle = { size: 9.5, color: EF_SUMMARY, fontStyle: 'italic', lineHeight: 4.2 };
  blocks.forEach((block, i) => {
    efDrawCenteredLines(ctx, efSplitText(ctx, block, ctx.contentWidth), style);
    if (i < blocks.length - 1) ctx.y += 2;
  });
  ctx.y += 3.5;
}

function efExperienceDescriptionParts(
  ctx: ElegantFormalDirectPdfContext,
  entry: CVData['experience'][number],
): Array<{ isBullet: boolean; lines: string[] }> {
  return entry.description
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map((part) => {
      const cleaned = part.replace(/^(?:[-•*]|\d+\.)\s+/, '');
      const isBullet = cleaned !== part;
      const bulletIndent = isBullet ? 5 : 0;
      return { isBullet, lines: efSplitText(ctx, cleaned, ctx.contentWidth - bulletIndent) };
    });
}

function efExperienceLeadBlockHeight(ctx: ElegantFormalDirectPdfContext, entry: CVData['experience'][number]): number {
  const titleLines = efSplitText(ctx, entry.position);
  const headerH = Math.max(4.0, titleLines.length * 4.0) + 3.5 + 1.5;
  const parts = efExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(p => p.isBullet);
  const leadParts = (bulletParts.length ? bulletParts : parts).slice(0, 2);
  return headerH + leadParts.reduce((sum, p) => sum + p.lines.length * 3.8, 0);
}

function efExperienceEntryHeight(ctx: ElegantFormalDirectPdfContext, entry: CVData['experience'][number]): number {
  const parts = efExperienceDescriptionParts(ctx, entry);
  return efExperienceLeadBlockHeight(ctx, entry)
    + parts.slice(2).reduce((sum, p) => sum + p.lines.length * 3.8, 0)
    + 3;
}

function efDrawWrappedBulletAtomic(
  ctx: ElegantFormalDirectPdfContext,
  part: { isBullet: boolean; lines: string[] },
): void {
  const lineH = 3.8;
  const blockH = part.lines.length * lineH;
  efEnsureSpace(ctx, blockH);
  efSetTextStyle(ctx, { size: 9.5, color: EF_MUTED, lineHeight: lineH });
  part.lines.forEach((line, index) => {
    const prefix = part.isBullet && index === 0 ? '• ' : part.isBullet ? '  ' : '';
    ctx.pdf.text(`${prefix}${line}`, ctx.marginLeft + (part.isBullet ? 4 : 0), ctx.y);
    ctx.y += lineH;
  });
}

function efDrawExperienceEntryPaginated(ctx: ElegantFormalDirectPdfContext, entry: CVData['experience'][number]): void {
  const dateText = efDirectDateRange(entry.startDate, entry.endDate, entry.isPresent, ctx.labels.present);
  const fullH = efExperienceEntryHeight(ctx, entry);
  const leadH = efExperienceLeadBlockHeight(ctx, entry);
  const remainingSpace = ctx.bottomSafeY - ctx.y;
  const freshCap = efFreshPageCapacity(ctx);

  const drawHeader = () => {
    const titleLines = efSplitText(ctx, entry.position);
    const titleLineH = 4.0;
    const headerBlockH = Math.max(titleLineH, titleLines.length * titleLineH);
    efEnsureSpace(ctx, headerBlockH);
    efSetTextStyle(ctx, { size: 10, color: EF_TEXT, fontStyle: 'bold', lineHeight: titleLineH });
    titleLines.forEach((line) => {
      ctx.pdf.text(line, ctx.marginLeft, ctx.y);
      ctx.y += titleLineH;
    });
    if (dateText) {
      efSetTextStyle(ctx, { size: 9, color: EF_LIGHT, fontStyle: 'italic', lineHeight: 3.5 });
      const dateX = ctx.pageWidth - ctx.marginRight - ctx.pdf.getTextWidth(dateText);
      ctx.pdf.text(dateText, dateX, ctx.y - titleLineH + 0.5);
    }
    if (entry.company) {
      efDrawLinesBlock(ctx, efSplitText(ctx, entry.company), { size: 9, color: EF_AMBER, lineHeight: 3.5 });
    } else {
      ctx.y += 1;
    }
  };

  if (fullH <= remainingSpace) {
    drawHeader();
    for (const part of efExperienceDescriptionParts(ctx, entry)) {
      efDrawWrappedBulletAtomic(ctx, part);
    }
    ctx.y += 2.5;
    return;
  }

  if (leadH > remainingSpace && leadH <= freshCap) {
    efAddPage(ctx);
  }

  drawHeader();
  const parts = efExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(p => p.isBullet);
  const useGrouped = bulletParts.length > 0;
  const leadParts = (useGrouped ? bulletParts : parts).slice(0, 2);
  const tailParts = (useGrouped ? bulletParts : parts).slice(leadParts.length);
  const nonBulletParts = useGrouped ? parts.filter(p => !p.isBullet) : [];

  for (const part of leadParts) efDrawWrappedBulletAtomic(ctx, part);
  for (const part of nonBulletParts) efDrawWrappedBulletAtomic(ctx, part);

  let continuationShown = false;
  for (const part of tailParts) {
    const partH = part.lines.length * 3.8;
    if (ctx.y + partH > ctx.bottomSafeY) {
      efAddPage(ctx);
      if (!continuationShown) {
        efSetTextStyle(ctx, { size: 9.5, color: EF_TEXT, fontStyle: 'italic', lineHeight: 3.8 });
        const cont = `${entry.position} (continued)`;
        ctx.pdf.text(cont, ctx.marginLeft, ctx.y);
        ctx.y += 4.2;
        continuationShown = true;
      }
    }
    efDrawWrappedBulletAtomic(ctx, part);
  }
  ctx.y += 2.5;
}

function efDrawExperience(ctx: ElegantFormalDirectPdfContext, cv: CVData): void {
  if (!cv.experience.length) return;
  const leadH = efSectionHeadingHeight(true) + efExperienceLeadBlockHeight(ctx, cv.experience[0]);
  efMoveToFreshPageIfNeeded(ctx, leadH);
  efDrawSectionHeading(ctx, ctx.labels.experience, true);
  for (const entry of cv.experience) {
    efDrawExperienceEntryPaginated(ctx, entry);
  }
  ctx.y += 1.5;
}

function efEducationEntryHeight(ctx: ElegantFormalDirectPdfContext, edu: CVData['education'][number]): number {
  const degreeLines = efSplitText(ctx, edu.degree);
  const degreeH = Math.max(4.0, degreeLines.length * 4.0);
  const metaH = (edu.school || edu.startDate || edu.endDate) ? 3.5 : 0;
  return degreeH + metaH + 2;
}

function efEducationHeight(ctx: ElegantFormalDirectPdfContext, cv: CVData): number {
  if (!cv.education.length) return 0;
  let h = efSectionHeadingHeight(true);
  for (const edu of cv.education) h += efEducationEntryHeight(ctx, edu);
  return h + 2;
}

function efDrawEducationEntry(ctx: ElegantFormalDirectPdfContext, edu: CVData['education'][number]): void {
  const entryH = efEducationEntryHeight(ctx, edu);
  efMoveToFreshPageIfNeeded(ctx, entryH);
  efDrawCenteredLines(
    ctx,
    efSplitText(ctx, edu.degree),
    { size: 10, color: EF_TEXT, fontStyle: 'bold', lineHeight: 4.0 },
  );
  const dateParts = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
  const metaText = [edu.school, dateParts].filter(Boolean).join(' | ');
  if (metaText) {
    efDrawCenteredLines(
      ctx,
      efSplitText(ctx, metaText),
      { size: 9, color: EF_EDU_META, lineHeight: 3.5 },
    );
  }
  ctx.y += 2;
}

function efDrawEducation(ctx: ElegantFormalDirectPdfContext, cv: CVData): void {
  if (!cv.education.length) return;
  const fullH = efEducationHeight(ctx, cv);
  const headingPlusFirst = efSectionHeadingHeight(true) + efEducationEntryHeight(ctx, cv.education[0]);
  if (fullH <= efFreshPageCapacity(ctx)) {
    efMoveToFreshPageIfNeeded(ctx, fullH);
  } else {
    efMoveToFreshPageIfNeeded(ctx, headingPlusFirst);
  }
  efDrawSectionHeading(ctx, ctx.labels.education, true);
  for (const edu of cv.education) efDrawEducationEntry(ctx, edu);
  ctx.y += 1.5;
}

type EfInlineRow = { items: string[]; y: number; height: number };

function efLayoutInlineItems(ctx: ElegantFormalDirectPdfContext, items: string[], colW: number): EfInlineRow[] {
  const gapX = 2.8;
  const gapY = 1.2;
  const lineH = 3.8;
  efSetTextStyle(ctx, { size: 9, color: EF_MUTED, lineHeight: lineH });
  const rows: EfInlineRow[] = [];
  let rowItems: string[] = [];
  let rowWidth = 0;
  let rowY = 0;
  let rowHeight = lineH;

  const flush = () => {
    if (!rowItems.length) return;
    rows.push({ items: rowItems, y: rowY, height: rowHeight });
    rowY += rowHeight + gapY;
    rowItems = [];
    rowWidth = 0;
    rowHeight = lineH;
  };

  for (const item of items) {
    const itemW = ctx.pdf.getTextWidth(item);
    const nextW = rowWidth > 0 ? rowWidth + gapX + itemW : itemW;
    if (rowItems.length > 0 && nextW > colW) flush();
    rowWidth = rowItems.length > 0 ? rowWidth + gapX + itemW : itemW;
    rowItems.push(item);
  }
  flush();
  return rows;
}

function efMeasureInlineItemsHeight(ctx: ElegantFormalDirectPdfContext, items: string[], colW: number): number {
  const rows = efLayoutInlineItems(ctx, items, colW);
  if (!rows.length) return 0;
  const last = rows[rows.length - 1];
  return last.y + last.height;
}

function efDrawInlineItems(ctx: ElegantFormalDirectPdfContext, items: string[], colX: number, colW: number, startY: number): number {
  const rows = efLayoutInlineItems(ctx, items, colW);
  efSetTextStyle(ctx, { size: 9, color: EF_MUTED, lineHeight: 3.8 });
  for (const row of rows) {
    const totalW = row.items.reduce((sum, item, i) => sum + ctx.pdf.getTextWidth(item) + (i > 0 ? 2.8 : 0), 0);
    let x = colX + (colW - totalW) / 2;
    const y = startY + row.y;
    for (const item of row.items) {
      ctx.pdf.text(item, x, y);
      x += ctx.pdf.getTextWidth(item) + 2.8;
    }
  }
  const h = efMeasureInlineItemsHeight(ctx, items, colW);
  return startY + h;
}

function efLowerColumns(ctx: ElegantFormalDirectPdfContext, cv: CVData): Array<{ key: string; heading: string; items: string[] }> {
  const columns: Array<{ key: string; heading: string; items: string[] }> = [];
  const skills = cv.skills.map(s => getLocalizedCvSkillName(s, ctx.locale));
  const languages = cv.languages.map(l =>
    `${getLocalizedCvLanguageName(l.name, ctx.locale)} (${l.level})`,
  );
  if (skills.length) columns.push({ key: 'skills', heading: ctx.labels.skills, items: skills });
  if (languages.length) columns.push({ key: 'languages', heading: ctx.labels.languages, items: languages });
  if (cv.certifications.length) {
    columns.push({ key: 'certifications', heading: ctx.labels.certifications, items: cv.certifications });
  }
  return columns;
}

function efLowerBlockHeight(ctx: ElegantFormalDirectPdfContext, cv: CVData): number {
  const columns = efLowerColumns(ctx, cv);
  if (!columns.length) return 0;
  const colCount = columns.length;
  const colW = (ctx.contentWidth - EF_LOWER_COL_GAP_MM * (colCount - 1)) / colCount;
  let maxColH = 0;
  for (const col of columns) {
    const headingH = 5.2;
    const itemsH = efMeasureInlineItemsHeight(ctx, col.items, colW);
    maxColH = Math.max(maxColH, headingH + itemsH);
  }
  return 2.5 + 2.5 + maxColH + 2;
}

function efDrawSkillsLanguagesBlock(ctx: ElegantFormalDirectPdfContext, cv: CVData): void {
  const columns = efLowerColumns(ctx, cv);
  if (!columns.length) return;

  const blockH = efLowerBlockHeight(ctx, cv);
  efMoveToFreshPageIfNeeded(ctx, blockH);

  ctx.pdf.setDrawColor(EF_RULE[0], EF_RULE[1], EF_RULE[2]);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.marginLeft, ctx.y, ctx.pageWidth - ctx.marginRight, ctx.y);
  ctx.y += 2.5;

  const colCount = columns.length;
  const colW = (ctx.contentWidth - EF_LOWER_COL_GAP_MM * (colCount - 1)) / colCount;
  const blockTopY = ctx.y;
  let blockBottom = blockTopY;

  columns.forEach((col, index) => {
    const colX = ctx.marginLeft + index * (colW + EF_LOWER_COL_GAP_MM);
    const headingEnd = efDrawSectionHeadingAt(ctx, col.heading, colX, colW, blockTopY);
    const itemsBottom = efDrawInlineItems(ctx, col.items, colX, colW, headingEnd);
    blockBottom = Math.max(blockBottom, itemsBottom);
  });

  ctx.y = blockBottom + 2;
}

function efMoveLowerSectionsIfNeeded(
  ctx: ElegantFormalDirectPdfContext,
  educationH: number,
  lowerH: number,
): void {
  const combined = educationH + lowerH;
  if (combined <= 0) return;
  const freshCap = efFreshPageCapacity(ctx);
  const remaining = ctx.bottomSafeY - ctx.y;

  if (combined <= remaining) return;
  if (combined <= freshCap) {
    efAddPage(ctx);
    return;
  }

  const eduLowerH = educationH + lowerH;
  if (eduLowerH > 0 && eduLowerH <= freshCap && eduLowerH > remaining) {
    efAddPage(ctx);
  }
}

export async function buildElegantFormalPagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginLeft = 9;
  const marginRight = 9;
  const marginTop = 9;
  const marginBottom = 11;
  const ctx: ElegantFormalDirectPdfContext = {
    pdf,
    locale,
    labels: getElegantFormalPdfLabels(locale),
    pageWidth: CV_PDF_A4_WIDTH_MM,
    pageHeight: CV_PDF_A4_HEIGHT_MM,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    contentWidth: CV_PDF_A4_WIDTH_MM - marginLeft - marginRight,
    bottomSafeY: CV_PDF_A4_HEIGHT_MM - marginBottom,
    y: 0,
    pageIndex: 0,
  };

  ctx.y = ctx.marginTop;
  efDrawHeader(ctx, cv, options.photoDataUrl ?? null);
  efDrawSummary(ctx, cv.summary);
  efDrawExperience(ctx, cv);

  const educationH = efEducationHeight(ctx, cv);
  const lowerH = efLowerBlockHeight(ctx, cv);
  efMoveLowerSectionsIfNeeded(ctx, educationH, lowerH);

  if (educationH > 0) efDrawEducation(ctx, cv);
  if (lowerH > 0) {
    if (lowerH <= efFreshPageCapacity(ctx)) {
      efMoveToFreshPageIfNeeded(ctx, lowerH);
    } else {
      const columns = efLowerColumns(ctx, cv);
      const colW = (ctx.contentWidth - EF_LOWER_COL_GAP_MM * Math.max(columns.length - 1, 0)) / Math.max(columns.length, 1);
      const skillsCol = columns.find(c => c.key === 'skills');
      if (skillsCol) {
        efMoveToFreshPageIfNeeded(ctx, 5.2 + efMeasureInlineItemsHeight(ctx, skillsCol.items, colW));
      }
    }
    efDrawSkillsLanguagesBlock(ctx, cv);
  }

  const output = pdf.output('blob');
  return output instanceof Blob ? output : new Blob([output], { type: 'application/pdf' });
}

export async function buildElegantFormalPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const personalPhotoFields = cv.personal as CVData['personal'] & { originalPhoto?: string };
  const photoDataUrl = options.photoDataUrl ?? null;
  if (personalPhotoFields.originalPhoto && !photoDataUrl) {
    throw new Error('ELEGANT_FORMAL_PDF_PHOTO_PROP_MISSING');
  }

  const blob = await buildElegantFormalPagedPdfBlob(cv, locale, { photoDataUrl });
  if (!blob || blob.size === 0) throw new Error('Elegant Formal PDF generation produced an empty Blob');
  return blob;
}

export async function exportElegantFormalPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<SaveFileResult> {
  const pdfBlob = await buildElegantFormalPdfBlob(cv, locale, options);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

type AtsStandardPdfWriter = InstanceType<typeof import('jspdf').jsPDF>;

type AtsStandardDirectPdfContext = {
  pdf: AtsStandardPdfWriter;
  locale: Locale;
  labels: ReturnType<typeof getAtsStandardPdfLabels>;
  pageWidth: number;
  pageHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  contentWidth: number;
  bottomSafeY: number;
  y: number;
  pageIndex: number;
};

type AtsStandardTextStyle = {
  size: number;
  color: [number, number, number];
  fontStyle?: 'normal' | 'bold' | 'italic';
  lineHeight: number;
};

const ATS_TEXT: [number, number, number] = [17, 24, 39];
const ATS_BODY: [number, number, number] = [31, 41, 55];
const ATS_MUTED: [number, number, number] = [75, 85, 99];
const ATS_RULE: [number, number, number] = [209, 213, 219];
const ATS_SEPARATOR: [number, number, number] = [156, 163, 175];

function getAtsStandardPdfLabels(locale: Locale) {
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

function atsSetTextStyle(ctx: AtsStandardDirectPdfContext, style: AtsStandardTextStyle): void {
  ctx.pdf.setFont('helvetica', style.fontStyle ?? 'normal');
  ctx.pdf.setFontSize(style.size);
  ctx.pdf.setTextColor(style.color[0], style.color[1], style.color[2]);
}

function atsSplitText(ctx: AtsStandardDirectPdfContext, text: string, maxWidth = ctx.contentWidth): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const result = ctx.pdf.splitTextToSize(normalized, maxWidth);
  return Array.isArray(result) ? result.map(String) : [String(result)];
}

function atsFreshPageCapacity(ctx: AtsStandardDirectPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

function atsAddPage(ctx: AtsStandardDirectPdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
}

function atsEnsureSpace(ctx: AtsStandardDirectPdfContext, heightNeeded: number): void {
  if (ctx.y + heightNeeded <= ctx.bottomSafeY) return;
  atsAddPage(ctx);
}

function atsMoveToFreshPageIfNeeded(ctx: AtsStandardDirectPdfContext, blockHeight: number): void {
  if (blockHeight > atsFreshPageCapacity(ctx)) return;
  if (ctx.y + blockHeight > ctx.bottomSafeY) {
    atsAddPage(ctx);
  }
}

function atsCenteredX(ctx: AtsStandardDirectPdfContext, text: string): number {
  return (ctx.pageWidth - ctx.pdf.getTextWidth(text)) / 2;
}

function atsSectionHeadingHeight(): number {
  return 7.5;
}

function atsDrawSectionHeading(ctx: AtsStandardDirectPdfContext, label: string): void {
  const blockH = atsSectionHeadingHeight();
  atsEnsureSpace(ctx, blockH);
  const upper = label.toUpperCase();
  atsSetTextStyle(ctx, { size: 8.6, color: ATS_TEXT, fontStyle: 'bold', lineHeight: 3.8 });
  ctx.pdf.text(upper, ctx.marginLeft, ctx.y);
  ctx.y += 4.2;
  ctx.pdf.setDrawColor(ATS_RULE[0], ATS_RULE[1], ATS_RULE[2]);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.marginLeft, ctx.y, ctx.pageWidth - ctx.marginRight, ctx.y);
  ctx.y += 3.2;
}

function atsDrawLines(
  ctx: AtsStandardDirectPdfContext,
  lines: string[],
  style: AtsStandardTextStyle,
  opts: { x?: number } = {},
): void {
  if (!lines.length) return;
  atsSetTextStyle(ctx, style);
  const x = opts.x ?? ctx.marginLeft;
  for (const line of lines) {
    atsEnsureSpace(ctx, style.lineHeight);
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function atsDrawLinesBlock(
  ctx: AtsStandardDirectPdfContext,
  lines: string[],
  style: AtsStandardTextStyle,
  opts: { x?: number } = {},
): void {
  if (!lines.length) return;
  const blockH = lines.length * style.lineHeight;
  atsMoveToFreshPageIfNeeded(ctx, blockH);
  atsSetTextStyle(ctx, style);
  const x = opts.x ?? ctx.marginLeft;
  for (const line of lines) {
    ctx.pdf.text(line, x, ctx.y);
    ctx.y += style.lineHeight;
  }
}

function atsDirectDateRange(start: string, end: string, present: boolean, presentLabel: string): string {
  return [start, present ? presentLabel : end].filter(Boolean).join(' - ');
}

function atsDrawHeader(ctx: AtsStandardDirectPdfContext, cv: CVData): void {
  const region = regionSettings[cv.region];
  const contacts = [
    cv.personal.email,
    cv.personal.phone,
    region.showAddress ? cv.personal.address : '',
  ].filter(Boolean) as string[];

  ctx.y = ctx.marginTop + 2;
  atsSetTextStyle(ctx, { size: 16, color: ATS_TEXT, fontStyle: 'bold', lineHeight: 5.0 });
  for (const line of atsSplitText(ctx, cv.personal.fullName || 'Your Name', ctx.contentWidth)) {
    ctx.pdf.text(line, atsCenteredX(ctx, line), ctx.y);
    ctx.y += 4.8;
  }

  if (cv.personal.jobTitle) {
    atsSetTextStyle(ctx, { size: 9, color: ATS_MUTED, lineHeight: 3.8 });
    for (const line of atsSplitText(ctx, cv.personal.jobTitle, ctx.contentWidth)) {
      ctx.pdf.text(line, atsCenteredX(ctx, line), ctx.y);
      ctx.y += 3.6;
    }
  }

  if (contacts.length > 0) {
    ctx.y += 1.2;
    atsSetTextStyle(ctx, { size: 8, color: ATS_MUTED, lineHeight: 3.4 });
    const contactLine = contacts.join('  |  ');
    for (const line of atsSplitText(ctx, contactLine, ctx.contentWidth)) {
      ctx.pdf.text(line, atsCenteredX(ctx, line), ctx.y);
      ctx.y += 3.4;
    }
  }

  ctx.y += 4;
}

function atsDrawSummary(ctx: AtsStandardDirectPdfContext, summary: string): void {
  const blocks = splitCleanSimpleSummaryParagraphBlocks(summary);
  if (!blocks.length) return;
  atsEnsureSpace(ctx, atsSectionHeadingHeight());
  atsDrawSectionHeading(ctx, ctx.labels.summary);
  const style: AtsStandardTextStyle = { size: 8.6, color: ATS_BODY, lineHeight: 4.0 };
  blocks.forEach((block, i) => {
    atsDrawLines(ctx, atsSplitText(ctx, block), style);
    if (i < blocks.length - 1) ctx.y += 2;
  });
  ctx.y += 3;
}

function atsExperienceDescriptionParts(
  ctx: AtsStandardDirectPdfContext,
  entry: CVData['experience'][number],
): Array<{ isBullet: boolean; lines: string[] }> {
  const bulletIndent = 5;
  const textW = ctx.contentWidth - bulletIndent;
  return entry.description
    .split(/\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map((part) => {
      const cleaned = part.replace(/^(?:[-•*]|\d+\.)\s+/, '');
      const isBullet = cleaned !== part;
      return { isBullet, lines: atsSplitText(ctx, cleaned, textW) };
    });
}

function atsExperienceLeadBlockHeight(ctx: AtsStandardDirectPdfContext, entry: CVData['experience'][number]): number {
  const titleLine = [entry.position, entry.company].filter(Boolean).join(', ');
  const headerH = Math.max(4.0, atsSplitText(ctx, titleLine).length * 4.0) + 1.5;
  const parts = atsExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(p => p.isBullet);
  const leadParts = (bulletParts.length ? bulletParts : parts).slice(0, 2);
  return headerH + leadParts.reduce((sum, p) => sum + p.lines.length * 3.7, 0);
}

function atsExperienceEntryHeight(ctx: AtsStandardDirectPdfContext, entry: CVData['experience'][number]): number {
  const parts = atsExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(p => p.isBullet);
  const leadParts = (bulletParts.length ? bulletParts : parts).slice(0, 2);
  const tailParts = (bulletParts.length ? bulletParts : parts).slice(leadParts.length);
  return atsExperienceLeadBlockHeight(ctx, entry)
    + tailParts.reduce((sum, p) => sum + p.lines.length * 3.7, 0)
    + 3;
}

function atsDrawWrappedBulletAtomic(
  ctx: AtsStandardDirectPdfContext,
  part: { isBullet: boolean; lines: string[] },
): void {
  const lineH = 3.7;
  const blockH = part.lines.length * lineH;
  atsEnsureSpace(ctx, blockH);
  atsSetTextStyle(ctx, { size: 8.6, color: ATS_BODY, lineHeight: lineH });
  part.lines.forEach((line, index) => {
    const prefix = part.isBullet && index === 0 ? '- ' : part.isBullet ? '  ' : '';
    ctx.pdf.text(`${prefix}${line}`, ctx.marginLeft + (part.isBullet ? 2 : 0), ctx.y);
    ctx.y += lineH;
  });
}

function atsDrawExperienceEntryPaginated(ctx: AtsStandardDirectPdfContext, entry: CVData['experience'][number]): void {
  const dateText = atsDirectDateRange(entry.startDate, entry.endDate, entry.isPresent, ctx.labels.present);
  const titleLine = [entry.position, entry.company].filter(Boolean).join(', ');
  const fullH = atsExperienceEntryHeight(ctx, entry);
  const leadH = atsExperienceLeadBlockHeight(ctx, entry);
  const remainingSpace = ctx.bottomSafeY - ctx.y;
  const freshCap = atsFreshPageCapacity(ctx);

  const drawHeader = () => {
    const titleLines = atsSplitText(ctx, titleLine, ctx.contentWidth - 28);
    const titleLineH = 4.0;
    const headerBlockH = Math.max(titleLineH, titleLines.length * titleLineH);
    atsEnsureSpace(ctx, headerBlockH);
    atsSetTextStyle(ctx, { size: 9.4, color: ATS_TEXT, fontStyle: 'bold', lineHeight: titleLineH });
    titleLines.forEach((line) => {
      ctx.pdf.text(line, ctx.marginLeft, ctx.y);
      ctx.y += titleLineH;
    });
    if (dateText) {
      atsSetTextStyle(ctx, { size: 8, color: ATS_MUTED, lineHeight: 3.4 });
      const dateX = ctx.pageWidth - ctx.marginRight - ctx.pdf.getTextWidth(dateText);
      ctx.pdf.text(dateText, dateX, ctx.y - titleLineH + 0.5);
    }
    ctx.y += 1;
  };

  if (fullH <= remainingSpace) {
    drawHeader();
    for (const part of atsExperienceDescriptionParts(ctx, entry)) {
      atsDrawWrappedBulletAtomic(ctx, part);
    }
    ctx.y += 2.5;
    return;
  }

  if (leadH > remainingSpace && leadH <= freshCap) {
    atsAddPage(ctx);
  }

  drawHeader();
  const parts = atsExperienceDescriptionParts(ctx, entry);
  const bulletParts = parts.filter(p => p.isBullet);
  const useGrouped = bulletParts.length > 0;
  const leadParts = (useGrouped ? bulletParts : parts).slice(0, 2);
  const tailParts = (useGrouped ? bulletParts : parts).slice(leadParts.length);
  const nonBulletParts = useGrouped ? parts.filter(p => !p.isBullet) : [];

  for (const part of leadParts) atsDrawWrappedBulletAtomic(ctx, part);
  for (const part of nonBulletParts) atsDrawWrappedBulletAtomic(ctx, part);

  let continuationShown = false;
  for (const part of tailParts) {
    const partH = part.lines.length * 3.7;
    if (ctx.y + partH > ctx.bottomSafeY) {
      atsAddPage(ctx);
      if (!continuationShown) {
        atsSetTextStyle(ctx, { size: 8.6, color: ATS_TEXT, fontStyle: 'italic', lineHeight: 3.7 });
        const cont = `${entry.position} (continued)`;
        ctx.pdf.text(cont, ctx.marginLeft, ctx.y);
        ctx.y += 4.0;
        continuationShown = true;
      }
    }
    atsDrawWrappedBulletAtomic(ctx, part);
  }
  ctx.y += 2.5;
}

function atsDrawExperience(ctx: AtsStandardDirectPdfContext, cv: CVData): void {
  if (!cv.experience.length) return;
  const leadH = atsSectionHeadingHeight() + atsExperienceLeadBlockHeight(ctx, cv.experience[0]);
  atsMoveToFreshPageIfNeeded(ctx, leadH);
  atsDrawSectionHeading(ctx, ctx.labels.experience);
  for (const entry of cv.experience) {
    atsDrawExperienceEntryPaginated(ctx, entry);
  }
  ctx.y += 1.5;
}

function atsEducationEntryHeight(ctx: AtsStandardDirectPdfContext, edu: CVData['education'][number]): number {
  const rowText = [edu.degree, edu.school].filter(Boolean).join(', ');
  const rowH = Math.max(4.0, atsSplitText(ctx, rowText).length * 4.0);
  const descH = edu.description ? atsSplitText(ctx, edu.description).length * 3.7 + 1 : 0;
  return rowH + descH + 2;
}

function atsEducationHeight(ctx: AtsStandardDirectPdfContext, cv: CVData): number {
  if (!cv.education.length) return 0;
  let h = atsSectionHeadingHeight();
  for (const edu of cv.education) h += atsEducationEntryHeight(ctx, edu);
  return h + 2;
}

function atsDrawEducationEntry(ctx: AtsStandardDirectPdfContext, edu: CVData['education'][number]): void {
  const entryH = atsEducationEntryHeight(ctx, edu);
  atsMoveToFreshPageIfNeeded(ctx, entryH);
  const rowText = [edu.degree, edu.school].filter(Boolean).join(', ');
  const dateText = [edu.startDate, edu.endDate].filter(Boolean).join(' - ');
  const titleLines = atsSplitText(ctx, rowText, ctx.contentWidth - 28);
  const titleLineH = 4.0;
  atsEnsureSpace(ctx, titleLines.length * titleLineH);
  atsSetTextStyle(ctx, { size: 8.6, color: ATS_TEXT, fontStyle: 'bold', lineHeight: titleLineH });
  titleLines.forEach((line) => {
    ctx.pdf.text(line, ctx.marginLeft, ctx.y);
    ctx.y += titleLineH;
  });
  if (dateText) {
    atsSetTextStyle(ctx, { size: 8, color: ATS_MUTED, lineHeight: 3.4 });
    const dateX = ctx.pageWidth - ctx.marginRight - ctx.pdf.getTextWidth(dateText);
    ctx.pdf.text(dateText, dateX, ctx.y - titleLineH + 0.5);
  }
  if (edu.description) {
    atsDrawLines(ctx, atsSplitText(ctx, edu.description), { size: 8.4, color: ATS_BODY, lineHeight: 3.7 });
  }
  ctx.y += 1.5;
}

function atsDrawEducation(ctx: AtsStandardDirectPdfContext, cv: CVData): void {
  if (!cv.education.length) return;
  const fullH = atsEducationHeight(ctx, cv);
  const headingPlusFirst = atsSectionHeadingHeight() + atsEducationEntryHeight(ctx, cv.education[0]);
  if (fullH <= atsFreshPageCapacity(ctx)) {
    atsMoveToFreshPageIfNeeded(ctx, fullH);
  } else {
    atsMoveToFreshPageIfNeeded(ctx, headingPlusFirst);
  }
  atsDrawSectionHeading(ctx, ctx.labels.education);
  for (const edu of cv.education) atsDrawEducationEntry(ctx, edu);
  ctx.y += 1.5;
}

function atsSkillsHeight(ctx: AtsStandardDirectPdfContext, cv: CVData): number {
  if (!cv.skills.length) return 0;
  const skills = cv.skills.map(s => getLocalizedCvSkillName(s, ctx.locale));
  const lineH = 3.7;
  atsSetTextStyle(ctx, { size: 8.4, color: ATS_BODY, lineHeight: lineH });
  const rows = atsLayoutPipeItems(ctx, skills, ctx.contentWidth);
  return atsSectionHeadingHeight() + (rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].height : 0) + 2;
}

function atsLanguagesHeight(ctx: AtsStandardDirectPdfContext, cv: CVData): number {
  if (!cv.languages.length) return 0;
  return atsSectionHeadingHeight() + cv.languages.length * 3.7 + 2;
}

function atsCertificationsHeight(ctx: AtsStandardDirectPdfContext, cv: CVData): number {
  if (!cv.certifications.length) return 0;
  return atsSectionHeadingHeight() + cv.certifications.length * 3.7 + 2;
}

type AtsPipeRow = { items: string[]; y: number; height: number };

function atsLayoutPipeItems(ctx: AtsStandardDirectPdfContext, items: string[], maxWidth: number): AtsPipeRow[] {
  const gapX = 2.4;
  const gapY = 1.0;
  const lineH = 3.7;
  const sep = ' | ';
  atsSetTextStyle(ctx, { size: 8.4, color: ATS_BODY, lineHeight: lineH });
  const rows: AtsPipeRow[] = [];
  let rowItems: string[] = [];
  let rowWidth = 0;
  let rowY = 0;

  const flush = () => {
    if (!rowItems.length) return;
    rows.push({ items: rowItems, y: rowY, height: lineH });
    rowY += lineH + gapY;
    rowItems = [];
    rowWidth = 0;
  };

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const itemW = ctx.pdf.getTextWidth(item);
    const sepW = rowItems.length > 0 ? ctx.pdf.getTextWidth(sep) : 0;
    const nextW = rowWidth + sepW + itemW;
    if (rowItems.length > 0 && nextW > maxWidth) flush();
    rowWidth = rowItems.length > 0 ? rowWidth + ctx.pdf.getTextWidth(sep) + itemW : itemW;
    rowItems.push(item);
  }
  flush();
  return rows;
}

function atsDrawPipeItems(ctx: AtsStandardDirectPdfContext, items: string[], startY: number): number {
  const rows = atsLayoutPipeItems(ctx, items, ctx.contentWidth);
  const sep = ' | ';
  atsSetTextStyle(ctx, { size: 8.4, color: ATS_BODY, lineHeight: 3.7 });
  for (const row of rows) {
    let x = ctx.marginLeft;
    const y = startY + row.y;
    row.items.forEach((item, index) => {
      if (index > 0) {
        atsSetTextStyle(ctx, { size: 8.4, color: ATS_SEPARATOR, lineHeight: 3.7 });
        ctx.pdf.text(sep, x, y);
        x += ctx.pdf.getTextWidth(sep);
        atsSetTextStyle(ctx, { size: 8.4, color: ATS_BODY, lineHeight: 3.7 });
      }
      ctx.pdf.text(item, x, y);
      x += ctx.pdf.getTextWidth(item);
    });
  }
  const h = rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].height : 0;
  return startY + h;
}

function atsLowerSectionsHeight(ctx: AtsStandardDirectPdfContext, cv: CVData): number {
  let h = 0;
  if (cv.skills.length) h += atsSkillsHeight(ctx, cv);
  if (cv.languages.length) h += atsLanguagesHeight(ctx, cv);
  if (cv.certifications.length) h += atsCertificationsHeight(ctx, cv);
  return h;
}

function atsDrawSkills(ctx: AtsStandardDirectPdfContext, cv: CVData): void {
  if (!cv.skills.length) return;
  const skills = cv.skills.map(s => getLocalizedCvSkillName(s, ctx.locale));
  const blockH = atsSkillsHeight(ctx, cv);
  atsMoveToFreshPageIfNeeded(ctx, blockH);
  atsDrawSectionHeading(ctx, ctx.labels.skills);
  ctx.y = atsDrawPipeItems(ctx, skills, ctx.y) + 2;
}

function atsDrawLanguages(ctx: AtsStandardDirectPdfContext, cv: CVData): void {
  if (!cv.languages.length) return;
  const blockH = atsLanguagesHeight(ctx, cv);
  atsMoveToFreshPageIfNeeded(ctx, blockH);
  atsDrawSectionHeading(ctx, ctx.labels.languages);
  atsSetTextStyle(ctx, { size: 8.4, color: ATS_BODY, lineHeight: 3.7 });
  for (const lang of cv.languages) {
    atsEnsureSpace(ctx, 3.7);
    const line = `${getLocalizedCvLanguageName(lang.name, ctx.locale)} - ${lang.level}`;
    ctx.pdf.text(line, ctx.marginLeft, ctx.y);
    ctx.y += 3.7;
  }
  ctx.y += 2;
}

function atsDrawCertifications(ctx: AtsStandardDirectPdfContext, cv: CVData): void {
  if (!cv.certifications.length) return;
  const blockH = atsCertificationsHeight(ctx, cv);
  atsMoveToFreshPageIfNeeded(ctx, blockH);
  atsDrawSectionHeading(ctx, ctx.labels.certifications);
  atsSetTextStyle(ctx, { size: 8.4, color: ATS_BODY, lineHeight: 3.7 });
  for (const cert of cv.certifications) {
    atsEnsureSpace(ctx, 3.7);
    ctx.pdf.text(cert, ctx.marginLeft, ctx.y);
    ctx.y += 3.7;
  }
  ctx.y += 2;
}

function atsMoveLowerSectionsIfNeeded(
  ctx: AtsStandardDirectPdfContext,
  educationH: number,
  lowerH: number,
): void {
  const combined = educationH + lowerH;
  if (combined <= 0) return;
  const freshCap = atsFreshPageCapacity(ctx);
  const remaining = ctx.bottomSafeY - ctx.y;

  if (combined <= remaining) return;
  if (combined <= freshCap) {
    atsAddPage(ctx);
    return;
  }

  const eduLowerH = educationH + lowerH;
  if (eduLowerH > 0 && eduLowerH <= freshCap && eduLowerH > remaining) {
    atsAddPage(ctx);
  }
}

export async function buildAtsStandardPagedPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const marginLeft = 13;
  const marginRight = 13;
  const marginTop = 10;
  const marginBottom = 12;
  const ctx: AtsStandardDirectPdfContext = {
    pdf,
    locale,
    labels: getAtsStandardPdfLabels(locale),
    pageWidth: CV_PDF_A4_WIDTH_MM,
    pageHeight: CV_PDF_A4_HEIGHT_MM,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    contentWidth: CV_PDF_A4_WIDTH_MM - marginLeft - marginRight,
    bottomSafeY: CV_PDF_A4_HEIGHT_MM - marginBottom,
    y: 0,
    pageIndex: 0,
  };

  atsDrawHeader(ctx, cv);
  atsDrawSummary(ctx, cv.summary);
  atsDrawExperience(ctx, cv);

  const educationH = atsEducationHeight(ctx, cv);
  const lowerH = atsLowerSectionsHeight(ctx, cv);
  atsMoveLowerSectionsIfNeeded(ctx, educationH, lowerH);

  if (educationH > 0) atsDrawEducation(ctx, cv);

  if (lowerH > 0) {
    if (lowerH <= atsFreshPageCapacity(ctx)) {
      atsMoveToFreshPageIfNeeded(ctx, lowerH);
    } else if (cv.skills.length) {
      atsMoveToFreshPageIfNeeded(ctx, atsSkillsHeight(ctx, cv));
    }
    if (cv.skills.length) atsDrawSkills(ctx, cv);
    if (cv.languages.length) atsDrawLanguages(ctx, cv);
    if (cv.certifications.length) atsDrawCertifications(ctx, cv);
  }

  const output = pdf.output('blob');
  return output instanceof Blob ? output : new Blob([output], { type: 'application/pdf' });
}

export async function buildAtsStandardPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  const blob = await buildAtsStandardPagedPdfBlob(cv, locale);
  if (!blob || blob.size === 0) throw new Error('ATS Standard PDF generation produced an empty Blob');
  return blob;
}

export async function exportAtsStandardPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildAtsStandardPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

export async function buildExecutivePremiumPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Executive Premium PDF export requires a browser DOM');
  }

  const canonicalPhoto = await prepareExecutivePremiumCanonicalPhoto(cv);
  const container = document.createElement('div');
  container.id = `executive-premium-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-executive-premium-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createExecutivePremiumPdfTemplate(cv, {
    locale,
    photoDataUrl: canonicalPhoto?.dataUrl ?? null,
  }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('Executive Premium PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
}

export async function exportExecutivePremiumPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildExecutivePremiumPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

async function prepareNordicCleanPdfPhotoDataUrl(cv: CVData): Promise<NordicCleanCanonicalPhotoResult | null> {
  const showPhoto = cv.personal.photoEnabled !== undefined
    ? cv.personal.photoEnabled
    : cv.region !== 'US';
  if (!showPhoto) return null;

  const personalPhotos = cv.personal as CVData['personal'] & {
    originalPhoto?: string;
  };
  const source = personalPhotos.originalPhoto?.trim() || '';
  if (!source) return null;

  const prepared = await prepareCvPhotoForExport(source);
  if (!prepared?.dataUrl) return null;
  const squareDataUrl = await createNordicCleanSquarePhoto(prepared.dataUrl);
  const decoded = await decodeImageForExport(squareDataUrl);
  if (!decoded) return null;
  return {
    dataUrl: squareDataUrl,
    bytes: dataUrlToBytes(squareDataUrl),
    mimeType: 'image/jpeg',
    width: 164,
    height: 164,
    source: 'original-photo',
  };
}

export async function buildNordicCleanPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Nordic Clean PDF export requires a browser DOM');
  }

  const canonicalPhoto = await prepareNordicCleanPdfPhotoDataUrl(cv);
  const container = document.createElement('div');
  container.id = `nordic-clean-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-nordic-clean-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createNordicCleanPdfTemplate(cv, {
    locale,
    photoDataUrl: canonicalPhoto?.dataUrl ?? null,
  }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('Nordic Clean PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
}

export async function exportNordicCleanPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildNordicCleanPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
}

// ─── PDF Print Fallback ───────────────────────────────────────────────────────
// Opens the preview content in a dedicated print window so the browser's
// "Save as PDF" dialog can be used when direct PDF generation fails.
// Noto Sans @font-face rules are injected so all Unicode characters render
// correctly (č ć š đ ž, Cyrillic, Arabic, Hindi, Japanese).

export async function openPrintFallback(elementId: string, fileName: string): Promise<void> {
  // Native Android must NOT call window.open — route through printNativePdf instead
  if (isNative()) {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new SaveFailedError(`Print fallback: element #${elementId} not found in DOM`);
    }
    const result = await printNativePdf(element, fileName);
    if (result && result.result === 'failed') {
      throw new Error(result.message || 'Print failed on native device');
    }
    return;
  }
  const element = document.getElementById(elementId);
  if (!element) {
    throw new SaveFailedError(`Print fallback: element #${elementId} not found in DOM`);
  }

  // Collect all <style> and <link rel="stylesheet"> tags from the current page
  const pageStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(node => node.outerHTML)
    .join('\n');

  const printWindow = window.open('', '_blank', 'width=900,height=1200');
  if (!printWindow) throw new Error('Popup blocked. Please allow popups for this site to use the print fallback.');

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
): Promise<SaveFileResult> {
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

  return await saveFileViaPlatform(blob, `${fileName}.pdf`, 'application/pdf');
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

export async function exportCoverLetterToDOCX(content: string, fileName: string, candidateName = '', locale: Locale = 'en'): Promise<SaveFileResult> {
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
  return await saveFileViaPlatform(blob, `${fileName}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}
