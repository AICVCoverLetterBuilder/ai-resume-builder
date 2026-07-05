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
import { createCleanSimplePdfTemplate } from './clean-simple-pdf-template';
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
  return target.dataset.templateId === 'clean-simple'
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
  return target.dataset.templateId === templateId
    ? target
    : (target.querySelector(`[data-template-id="${templateId}"]`) as HTMLElement | null);
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
const ELEGANT_FORMAL_GROUP_PAGE_PADDING_PX = 0.5;
const ELEGANT_FORMAL_MAX_KEEP_GROUP_PAGE_RATIO = 0.9;
// Professional Classic previously had zero keep-together logic (pure fixed-height
// canvas slicing), which could cut a section heading or a single experience/education
// entry in half at a page boundary. A deliberately lower ratio than the 0.9 used by
// elegant-formal/creative-artistic is used here — only genuinely short blocks (a single
// entry, or a heading + short section) are ever pushed to the next page, so this can
// only ever close a small gap at the bottom of a page, never manufacture a large one by
// relocating a big multi-entry block.
const PROFESSIONAL_CLASSIC_GROUP_PAGE_PADDING_PX = 0.5;
const PROFESSIONAL_CLASSIC_MAX_KEEP_GROUP_PAGE_RATIO = 0.62;

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

function getRelativeExportRect(rootBox: { top: number }, element: HTMLElement): { top: number; bottom: number; height: number } | null {
  const rect = getPositiveRect(element.getBoundingClientRect(), element);
  if (!rect) return null;
  const top = rect.top - rootBox.top;
  const bottom = rect.bottom - rootBox.top;
  if (bottom <= top) return null;
  return { top, bottom, height: bottom - top };
}

function parseCssPx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shiftGroupToNextPage(group: HTMLElement, shiftPx: number): void {
  const currentInlineMargin = parseCssPx(group.style.marginTop);
  group.style.setProperty('margin-top', `${currentInlineMargin + shiftPx}px`);
}

export function applyCreativeArtisticKeepTogetherPagination(root: HTMLElement): void {
  const rootBox = getPositiveRect(root.getBoundingClientRect(), root);
  if (!rootBox || rootBox.width <= 0) return;

  const pageHeightCssPx = rootBox.width * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return;

  const groupSelectors = [
    '[data-export-group="education-section"]',
    '[data-export-group="skills-block"]',
  ].join(',');

  const maxShortGroupHeight = pageHeightCssPx * CREATIVE_ARTISTIC_MAX_KEEP_GROUP_PAGE_RATIO;

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
      const shiftPx = Math.max(0, nextPageTop - rect.top + CREATIVE_ARTISTIC_GROUP_PAGE_PADDING_PX);
      if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) continue;

      shiftGroupToNextPage(group, shiftPx);
      movedAnyGroup = true;
    }
    if (!movedAnyGroup) break;
  }
}

export function applyElegantFormalKeepTogetherPagination(root: HTMLElement): void {
  const rootBox = getPositiveRect(root.getBoundingClientRect(), root);
  if (!rootBox || rootBox.width <= 0) return;

  const pageHeightCssPx = rootBox.width * (CV_PDF_A4_HEIGHT_MM / CV_PDF_A4_WIDTH_MM);
  if (pageHeightCssPx <= 0) return;

  const groupSelectors = [
    '[data-export-group="experience-entry"]',
    '[data-export-group="education-section"]',
  ].join(',');

  const maxShortGroupHeight = pageHeightCssPx * ELEGANT_FORMAL_MAX_KEEP_GROUP_PAGE_RATIO;

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
      const shiftPx = Math.max(0, nextPageTop - rect.top + ELEGANT_FORMAL_GROUP_PAGE_PADDING_PX);
      if (shiftPx <= PDF_PAGE_INTERSECTION_EPSILON_PX) continue;

      shiftGroupToNextPage(group, shiftPx);
      movedAnyGroup = true;
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
  function sectionHeadingRow(kanji: string) {
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
    children.push(fixedTable(langRows, [4680, 4680], noBorder));
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

export async function buildCvPdfBlob(elementId: string): Promise<Blob> {
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

  const initialCaptureTarget = (element.firstElementChild as HTMLElement | null) ?? element;
  const initialCaptureTemplateId = getExportStyleTemplateId(initialCaptureTarget);
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
  try {
    // ── HARD VERIFICATION: capture the actual template child directly, not the
    //    scroll wrapper. The #cv-preview / #cv-inline-preview div is an
    //    overflow-auto container — html2canvas on that wrapper can silently clip
    //    to the visible viewport and miss styles on the child template element.
    //    By targeting the template child directly we guarantee we capture exactly
    //    what is rendered, including any background-color changes.
    const captureTarget = (firstChild as HTMLElement | null) ?? element;
    captureTemplateId = getExportStyleTemplateId(captureTarget);
    const sourceRootForTag = captureTemplateId ? getTemplateCaptureRoot(captureTarget, captureTemplateId) : null;
    if (captureTemplateId === 'elegant-formal' && sourceRootForTag) {
      sourceStyleSnapshots = snapshotInlineStyles(sourceRootForTag);
      applyElegantFormalPdfLayout(sourceRootForTag);
      normalizeElegantFormalPdfTextStyles(sourceRootForTag);
      applyElegantFormalPdfNoWrapItems(sourceRootForTag);
      applyElegantFormalKeepTogetherPagination(sourceRootForTag);
    }
    if (captureTemplateId === 'professional-classic' && sourceRootForTag) {
      // Must run on the real (pre-clone) source root, not only inside onclone: the
      // keep-together pass can push a short trailing group (e.g. Certifications) down
      // with extra margin to avoid a mid-heading split, which *increases* total document
      // height. captureWidth/captureHeight below are what fixes the html2canvas output
      // canvas size — measuring them before this pass ran previously left the canvas too
      // short, silently clipping whatever the shift pushed past the original bottom edge.
      applyProfessionalClassicKeepTogetherPagination(sourceRootForTag);
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
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'creative-artistic') {
          applyCreativeArtisticPdfLayout(cloneRoot);
          normalizeCreativeArtisticPdfTextStyles(cloneRoot);
          applyCreativeArtisticPdfNoWrapItems(cloneRoot);
          applyCreativeArtisticKeepTogetherPagination(cloneRoot);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
          expandRootToMeaningfulContentHeight(cloneRoot, semanticMeaningfulBounds);
          semanticMeaningfulBounds = measureExportMeaningfulContentBounds(cloneRoot);
        }
        if (captureTemplateId === 'elegant-formal') {
          applyElegantFormalPdfLayout(cloneRoot);
          normalizeElegantFormalPdfTextStyles(cloneRoot);
          applyElegantFormalPdfNoWrapItems(cloneRoot);
          applyElegantFormalKeepTogetherPagination(cloneRoot);
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
        if (captureTemplateId === 'rirekisho') {
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
  const shouldTrimBlankPdfSlices = captureTemplateId === 'clean-simple' || captureTemplateId === 'professional-classic' || captureTemplateId === 'creative-bold' || captureTemplateId === 'creative-artistic' || captureTemplateId === 'elegant-formal' || captureTemplateId === 'ats-standard' || captureTemplateId === 'executive-premium' || captureTemplateId === 'nordic-clean' || captureTemplateId === 'tech-sidebar' || captureTemplateId === 'corporate-navy' || captureTemplateId === 'contemporary-bold' || captureTemplateId === 'rirekisho';
  const shouldUseFullSemanticCanvas = (captureTemplateId === 'creative-artistic' || captureTemplateId === 'elegant-formal' || captureTemplateId === 'ats-standard' || captureTemplateId === 'executive-premium' || captureTemplateId === 'nordic-clean' || captureTemplateId === 'tech-sidebar' || captureTemplateId === 'corporate-navy' || captureTemplateId === 'contemporary-bold' || captureTemplateId === 'rirekisho' || captureTemplateId === 'professional-classic') && Boolean(semanticMeaningfulBounds);
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
      let offsetY = 0;
      let firstPage = true;

      while (offsetY < canvasHeightPx - trailingTolerancePx) {
        const sliceHeight = Math.min(pageHeightPx, canvasHeightPx - offsetY);
        if (semanticPagePlan && !firstPage) {
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
          && !firstPage
          && isTemplateCanvasSliceEffectivelyBlank(pdfCanvas, offsetY, sliceHeight, captureTemplateId)
        ) {
          break;
        }
        if (!firstPage) pdf.addPage();
        firstPage = false;

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvasWidthPx;
        sliceCanvas.height = sliceHeight;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(pdfCanvas, 0, offsetY, canvasWidthPx, sliceHeight, 0, 0, canvasWidthPx, sliceHeight);
        }
        const sliceImg = sliceCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightMM = (sliceHeight / canvasWidthPx) * CV_PDF_A4_WIDTH_MM;
        pdf.addImage(sliceImg, 'JPEG', 0, 0, CV_PDF_A4_WIDTH_MM, Math.min(sliceHeightMM, CV_PDF_A4_HEIGHT_MM));

        offsetY += pageHeightPx;
      }
    }

    // Unified flow: create a PDF Blob first, then hand it to the platform save
    // boundary. Android API 29+ saves through MediaStore in saveFileViaPlatform.
    const pdfBlob = pdfToBlob(pdf);
    if (!pdfBlob || pdfBlob.size === 0) {
      throw new Error('PDF generation produced an empty or invalid Blob');
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

export async function buildCleanSimplePdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Clean Simple PDF export requires a browser DOM');
  }

  const photoDataUrl = await prepareCleanSimplePdfPhotoDataUrl(cv);
  const container = document.createElement('div');
  container.id = `clean-simple-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-clean-simple-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createCleanSimplePdfTemplate(cv, {
    locale,
    photoDataUrl,
  }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('Clean Simple PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
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

export async function buildProfessionalClassicPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Professional Classic PDF export requires a browser DOM');
  }

  const photoDataUrl = await prepareProfessionalClassicPdfPhotoDataUrl(cv);
  const container = document.createElement('div');
  container.id = `professional-classic-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-professional-classic-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createProfessionalClassicPdfTemplate(cv, {
    locale,
    photoDataUrl,
  }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('Professional Classic PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
}

export async function exportProfessionalClassicPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildProfessionalClassicPdfBlob(cv, locale);
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
  if (typeof document === 'undefined') {
    throw new Error('Creative Artistic PDF export requires a browser DOM');
  }

  const photoDataUrl = await prepareCreativeArtisticPdfPhotoDataUrl(cv);
  const container = document.createElement('div');
  container.id = `creative-artistic-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-creative-artistic-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createCreativeArtisticPdfTemplate(cv, {
    locale,
    photoDataUrl,
  }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('Creative Artistic PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
}

export async function exportCreativeArtisticPdf(
  cv: CVData,
  fileName: string,
  locale: Locale,
): Promise<SaveFileResult> {
  const pdfBlob = await buildCreativeArtisticPdfBlob(cv, locale);
  return await saveFileViaPlatform(pdfBlob, `${fileName}.pdf`, 'application/pdf');
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

export async function buildElegantFormalPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('Elegant Formal PDF export requires a browser DOM');
  }

  const personalPhotoFields = cv.personal as CVData['personal'] & { originalPhoto?: string };
  const photoDataUrl = options.photoDataUrl ?? null;
  if (personalPhotoFields.originalPhoto && !photoDataUrl) {
    throw new Error('ELEGANT_FORMAL_PDF_PHOTO_PROP_MISSING');
  }

  const container = document.createElement('div');
  container.id = `elegant-formal-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-elegant-formal-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createElegantFormalPdfTemplate(cv, { locale, photoDataUrl }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('Elegant Formal PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
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

export async function buildAtsStandardPdfBlob(
  cv: CVData,
  locale: Locale,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('ATS Standard PDF export requires a browser DOM');
  }

  const container = document.createElement('div');
  container.id = `ats-standard-pdf-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  container.setAttribute('data-ats-standard-pdf-export-container', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = '210mm';
  container.style.minWidth = '210mm';
  container.style.backgroundColor = '#ffffff';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.opacity = '1';
  container.appendChild(createAtsStandardPdfTemplate(cv, { locale }));
  document.body.appendChild(container);

  try {
    await awaitExportTemplateImages(container);
    const blob = await buildCvPdfBlob(container.id);
    if (!blob || blob.size === 0) throw new Error('ATS Standard PDF generation produced an empty Blob');
    return blob;
  } finally {
    container.remove();
  }
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
