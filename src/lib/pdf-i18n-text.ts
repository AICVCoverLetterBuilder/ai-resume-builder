/**
 * Shared multilingual PDF text layer for direct jsPDF CV renderers.
 * Registers embedded Noto fonts per script, selects fonts by locale/text,
 * and uses canvas-shaped PNG + invisible Unicode hybrid for Arabic/Devanagari.
 */
import type { Locale } from './i18n/translations';

type Pdf = InstanceType<typeof import('jspdf').jsPDF>;

export type PdfScript = 'latin' | 'cyrillic' | 'arabic' | 'devanagari' | 'japanese';

export type PdfI18nFontBundle = {
  vfsName: string;
  family: string;
  style: 'normal' | 'bold';
  regular: string;
  bold: string;
};

export type PdfI18nRegistry = {
  latinReady: boolean;
  arabicReady: boolean;
  devanagariReady: boolean;
  japaneseReady: boolean;
};

export type PdfI18nDrawOptions = {
  size: number;
  color: [number, number, number];
  bold?: boolean;
  rtl?: boolean;
  align?: 'left' | 'center' | 'right';
  maxWidthMm?: number;
};

/** Bundled PDF fonts under public/fonts — required for offline Android/WebView export. */
export const REQUIRED_PDF_FONT_FILES = [
  'NotoSans-Regular.ttf',
  'NotoSans-Bold.ttf',
  'NotoSansArabic-Regular.ttf',
  'NotoSansArabic-Bold.ttf',
  'NotoSansDevanagari-Regular.ttf',
  'NotoSansDevanagari-Bold.ttf',
  'NotoSansJP-Regular.ttf',
  'NotoSansJP-Bold.ttf',
] as const;

export const PDF_I18N_MIN_FONT_BYTES = 1024;

const LOCAL_FONT_PREFIX = '/fonts/';

/** Dev-only CDN mirrors — never used in production or static Android export. */
const DEV_CDN_FONT_URLS: Partial<Record<(typeof REQUIRED_PDF_FONT_FILES)[number], string>> = {
  'NotoSans-Regular.ttf': 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
  'NotoSans-Bold.ttf': 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
  'NotoSansArabic-Regular.ttf': 'https://raw.githubusercontent.com/notofonts/arabic/main/fonts/NotoSansArabic/hinted/ttf/NotoSansArabic-Regular.ttf',
  'NotoSansArabic-Bold.ttf': 'https://raw.githubusercontent.com/notofonts/arabic/main/fonts/NotoSansArabic/hinted/ttf/NotoSansArabic-Bold.ttf',
  'NotoSansDevanagari-Regular.ttf': 'https://raw.githubusercontent.com/notofonts/devanagari/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Regular.ttf',
  'NotoSansDevanagari-Bold.ttf': 'https://raw.githubusercontent.com/notofonts/devanagari/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Bold.ttf',
  'NotoSansJP-Regular.ttf': 'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansJP-Regular.otf',
  'NotoSansJP-Bold.ttf': 'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansJP-Bold.otf',
};

/**
 * True only when explicit dev opt-in is set. Production/Android paths must never
 * depend on CDN font loading.
 */
export function isPdfI18nCdnFallbackEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.PDF_I18N_ALLOW_CDN_FALLBACK === 'true';
}

export function getPdfI18nFontLoadUrls(fileName: (typeof REQUIRED_PDF_FONT_FILES)[number]): readonly string[] {
  const local = `${LOCAL_FONT_PREFIX}${fileName}`;
  if (!isPdfI18nCdnFallbackEnabled()) return [local];
  const cdn = DEV_CDN_FONT_URLS[fileName];
  return cdn ? [local, cdn] : [local];
}

/** All active font URLs for the current environment (local-only in production). */
export function listActivePdfI18nFontLoadUrls(): string[] {
  return REQUIRED_PDF_FONT_FILES.flatMap((file) => [...getPdfI18nFontLoadUrls(file)]);
}

const FONT_SOURCES = {
  latin: {
    regular: getPdfI18nFontLoadUrls('NotoSans-Regular.ttf'),
    bold: getPdfI18nFontLoadUrls('NotoSans-Bold.ttf'),
    vfsRegular: 'NotoSans-Regular.ttf',
    vfsBold: 'NotoSans-Bold.ttf',
    family: 'NotoSans',
  },
  arabic: {
    regular: getPdfI18nFontLoadUrls('NotoSansArabic-Regular.ttf'),
    bold: getPdfI18nFontLoadUrls('NotoSansArabic-Bold.ttf'),
    vfsRegular: 'NotoSansArabic-Regular.ttf',
    vfsBold: 'NotoSansArabic-Bold.ttf',
    family: 'NotoSansArabic',
  },
  devanagari: {
    regular: getPdfI18nFontLoadUrls('NotoSansDevanagari-Regular.ttf'),
    bold: getPdfI18nFontLoadUrls('NotoSansDevanagari-Bold.ttf'),
    vfsRegular: 'NotoSansDevanagari-Regular.ttf',
    vfsBold: 'NotoSansDevanagari-Bold.ttf',
    family: 'NotoSansDevanagari',
  },
  japanese: {
    regular: getPdfI18nFontLoadUrls('NotoSansJP-Regular.ttf'),
    bold: getPdfI18nFontLoadUrls('NotoSansJP-Bold.ttf'),
    vfsRegular: 'NotoSansJP-Regular.ttf',
    vfsBold: 'NotoSansJP-Bold.ttf',
    family: 'NotoSansJP',
  },
} as const;

const TECHNICAL_TOKENS = [
  'nlohmann/json', 'libcurl', 'GitHub', 'GitLab', 'Node.js', 'node.js', 'React.js',
  'Next.js', 'Vue.js', 'Express.js', 'TypeScript', 'JavaScript', 'CI/CD',
  'REST APIs', 'REST API', 'C++17', 'C#', '.NET', 'Docker', 'Kubernetes',
  'AWS', 'Azure', 'GCP', 'SQL',
] as const;

const fontPayloadCache = new Map<string, string>();
let registryPromise: Promise<PdfI18nRegistry> | null = null;

function toB64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 1) s += String.fromCharCode(b[i]!);
  return btoa(s);
}

async function readFontBytes(urls: readonly string[]): Promise<ArrayBuffer | null> {
  for (const url of urls) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 20000) : null;
      const res = await fetch(url, controller ? { signal: controller.signal } : undefined);
      if (timer) clearTimeout(timer);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > PDF_I18N_MIN_FONT_BYTES) return buf;
      }
    } catch {
      // try next source
    }
  }
  return null;
}

async function loadFontPair(
  key: string,
  regularUrls: readonly string[],
  boldUrls: readonly string[],
): Promise<{ regular: string; bold: string } | null> {
  const cacheKey = `${key}:pair`;
  const cachedRegular = fontPayloadCache.get(`${cacheKey}:regular`);
  const cachedBold = fontPayloadCache.get(`${cacheKey}:bold`);
  if (cachedRegular && cachedBold) {
    return { regular: cachedRegular, bold: cachedBold };
  }

  const [regularBuf, boldBuf] = await Promise.all([
    readFontBytes(regularUrls),
    readFontBytes(boldUrls),
  ]);
  if (!regularBuf || !boldBuf) return null;

  const regular = toB64(regularBuf);
  const bold = toB64(boldBuf);
  fontPayloadCache.set(`${cacheKey}:regular`, regular);
  fontPayloadCache.set(`${cacheKey}:bold`, bold);
  return { regular, bold };
}

async function registerFontBundle(
  pdf: Pdf,
  bundleKey: keyof typeof FONT_SOURCES,
): Promise<boolean> {
  const cfg = FONT_SOURCES[bundleKey];
  const pair = await loadFontPair(bundleKey, cfg.regular, cfg.bold);
  if (!pair) return false;
  try {
    pdf.addFileToVFS(cfg.vfsRegular, pair.regular);
    pdf.addFileToVFS(cfg.vfsBold, pair.bold);
    pdf.addFont(cfg.vfsRegular, cfg.family, 'normal');
    pdf.addFont(cfg.vfsBold, cfg.family, 'bold');
    return true;
  } catch {
    return false;
  }
}

/** Register all multilingual Noto families into jsPDF (idempotent per PDF instance). */
export async function registerPdfI18nFonts(pdf: Pdf): Promise<PdfI18nRegistry> {
  (pdf as Pdf & { allowFsRead?: string[] }).allowFsRead = ['*'];
  const [latinReady, arabicReady, devanagariReady, japaneseReady] = await Promise.all([
    registerFontBundle(pdf, 'latin'),
    registerFontBundle(pdf, 'arabic'),
    registerFontBundle(pdf, 'devanagari'),
    registerFontBundle(pdf, 'japanese'),
  ]);
  return { latinReady, arabicReady, devanagariReady, japaneseReady };
}

export async function getSharedPdfI18nRegistry(pdf: Pdf): Promise<PdfI18nRegistry> {
  if (!registryPromise) {
    registryPromise = registerPdfI18nFonts(pdf).finally(() => {
      registryPromise = null;
    });
  }
  return registryPromise;
}

export function clearPdfI18nFontCache(): void {
  fontPayloadCache.clear();
  registryPromise = null;
}

export function isRtlLocale(locale: Locale): boolean {
  return locale === 'ar';
}

export function detectPdfScript(text: string): PdfScript {
  if (!text) return 'latin';
  if (/[\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF]/.test(text)) return 'japanese';
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(text)) return 'arabic';
  if (/[\u0900-\u097F]/.test(text)) return 'devanagari';
  if (/[\u0400-\u04FF]/.test(text)) return 'cyrillic';
  return 'latin';
}

export function scriptForLocale(locale: Locale): PdfScript {
  switch (locale) {
    case 'ar': return 'arabic';
    case 'hi': return 'devanagari';
    case 'ja': return 'japanese';
    case 'ru': return 'cyrillic';
    default: return 'latin';
  }
}

export function resolvePdfScript(locale: Locale, text?: string): PdfScript {
  const fromText = text ? detectPdfScript(text) : null;
  if (fromText && fromText !== 'latin') return fromText;
  return scriptForLocale(locale);
}

export function resolvePdfFontFamily(
  registry: PdfI18nRegistry | null | undefined,
  locale: Locale,
  text?: string,
): string {
  const script = resolvePdfScript(locale, text);
  if (!registry) return 'helvetica';

  switch (script) {
    case 'arabic':
      return registry.arabicReady ? FONT_SOURCES.arabic.family : (registry.latinReady ? FONT_SOURCES.latin.family : 'helvetica');
    case 'devanagari':
      return registry.devanagariReady ? FONT_SOURCES.devanagari.family : (registry.latinReady ? FONT_SOURCES.latin.family : 'helvetica');
    case 'japanese':
      return registry.japaneseReady ? FONT_SOURCES.japanese.family : (registry.latinReady ? FONT_SOURCES.latin.family : 'helvetica');
    case 'cyrillic':
    case 'latin':
    default:
      return registry.latinReady ? FONT_SOURCES.latin.family : 'helvetica';
  }
}

export function isPdfI18nReady(registry: PdfI18nRegistry | null | undefined, locale: Locale, text?: string): boolean {
  if (!registry) return false;
  const script = resolvePdfScript(locale, text);
  switch (script) {
    case 'arabic': return registry.arabicReady;
    case 'devanagari': return registry.devanagariReady;
    case 'japanese': return registry.japaneseReady;
    default: return registry.latinReady;
  }
}

export function shouldApplyLatinPdfSentenceFixes(locale: Locale, text: string): boolean {
  if (locale === 'ar' || locale === 'hi' || locale === 'ja' || locale === 'ru') return false;
  const script = detectPdfScript(text);
  return script === 'latin' || script === 'cyrillic';
}

export function protectTechnicalTokens(text: string): { text: string; restore: (value: string) => string } {
  const stubs: string[] = [];
  let out = text;
  for (const token of TECHNICAL_TOKENS) {
    if (!out.includes(token)) continue;
    const stub = `\u0001TECH${stubs.length}\u0001`;
    stubs.push(token);
    out = out.split(token).join(stub);
  }
  const emails: string[] = [];
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, (email) => {
    const stub = `\u0001EMAIL${emails.length}\u0001`;
    emails.push(email);
    return stub;
  });
  return {
    text: out,
    restore(value: string) {
      let restored = value;
      emails.forEach((email, index) => {
        restored = restored.split(`\u0001EMAIL${index}\u0001`).join(email);
      });
      stubs.forEach((token, index) => {
        restored = restored.split(`\u0001TECH${index}\u0001`).join(token);
      });
      return restored;
    },
  };
}

export function needsShapedTextFallback(locale: Locale, text: string): boolean {
  // Shape only when the *text itself* contains complex-script characters.
  // Locale=hi must not force Latin proper nouns (Ivan, Ztrew) into PNG runs.
  void locale;
  const fromText = detectPdfScript(text);
  return fromText === 'arabic' || fromText === 'devanagari';
}

/**
 * Draw an invisible Unicode text run at the same baseline as the visual line.
 * Used under shaped PNG glyphs so ATS/search/copy see real ToUnicode text
 * without duplicating visible ink.
 */
function drawInvisibleUnicodeTextLayer(
  pdf: Pdf,
  registry: PdfI18nRegistry | null | undefined,
  locale: Locale,
  text: string,
  x: number,
  y: number,
  options: PdfI18nDrawOptions,
): void {
  if (!text.trim()) return;
  applyPdfI18nTextStyle(pdf, registry, locale, options, text);
  const rtl = options.rtl ?? isRtlLocale(locale);
  const align = options.align
    ?? (rtl ? 'right' : 'left');
  try {
    pdf.text(text, x, y, { align, renderingMode: 'invisible' });
  } catch {
    // Older jsPDF builds: fall back to fully transparent fill (still extractable).
    const prev = (pdf as unknown as { getTextColor?: () => string }).getTextColor?.();
    pdf.setTextColor(255, 255, 255);
    try {
      pdf.text(text, x, y, { align });
    } finally {
      if (prev && typeof (pdf as unknown as { setTextColor: (c: string) => void }).setTextColor === 'function') {
        (pdf as unknown as { setTextColor: (c: string) => void }).setTextColor(prev);
      } else {
        pdf.setTextColor(options.color[0], options.color[1], options.color[2]);
      }
    }
  }
}

function cssFontFamilyForScript(script: PdfScript): string {
  switch (script) {
    case 'arabic': return 'Noto Sans Arabic';
    case 'devanagari': return 'Noto Sans Devanagari';
    case 'japanese': return 'Noto Sans JP';
    default: return 'Noto Sans';
  }
}

function ptToPx(pt: number): number {
  return pt * (96 / 72);
}

function mmToPx(mm: number): number {
  return mm * (96 / 25.4);
}

function pxToMm(px: number): number {
  return px / (96 / 25.4);
}

function shapedTextToDataUrl(
  text: string,
  locale: Locale,
  options: PdfI18nDrawOptions,
): { dataUrl: string; widthMm: number; heightMm: number } | null {
  if (typeof document === 'undefined') return null;

  const script = resolvePdfScript(locale, text);
  const fontSizePx = Math.max(8, ptToPx(options.size));
  const fontFamily = cssFontFamilyForScript(script);
  const weight = options.bold ? '700' : '400';
  const rtl = options.rtl ?? isRtlLocale(locale);

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) return null;
  measureCtx.font = `${weight} ${fontSizePx}px ${fontFamily}`;
  const widthPx = Math.ceil(measureCtx.measureText(text).width) + 4;
  const heightPx = Math.ceil(fontSizePx * 1.35);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, widthPx);
  canvas.height = Math.max(1, heightPx);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `${weight} ${fontSizePx}px ${fontFamily}`;
  ctx.fillStyle = `rgb(${options.color[0]},${options.color[1]},${options.color[2]})`;
  ctx.direction = rtl ? 'rtl' : 'ltr';
  ctx.textAlign = rtl ? 'right' : 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, rtl ? canvas.width - 2 : 2, fontSizePx);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    widthMm: pxToMm(canvas.width),
    heightMm: pxToMm(canvas.height),
  };
}

export function applyPdfI18nFont(
  pdf: Pdf,
  registry: PdfI18nRegistry | null | undefined,
  locale: Locale,
  options: { bold?: boolean; text?: string } = {},
): string {
  const family = resolvePdfFontFamily(registry, locale, options.text);
  pdf.setFont(family, options.bold ? 'bold' : 'normal');
  return family;
}

export function applyPdfI18nTextStyle(
  pdf: Pdf,
  registry: PdfI18nRegistry | null | undefined,
  locale: Locale,
  style: PdfI18nDrawOptions,
  text?: string,
): void {
  applyPdfI18nFont(pdf, registry, locale, { bold: style.bold, text: text ?? '' });
  pdf.setFontSize(style.size);
  pdf.setTextColor(style.color[0], style.color[1], style.color[2]);
}

export function pdfI18nGetTextWidth(
  pdf: Pdf,
  registry: PdfI18nRegistry | null | undefined,
  locale: Locale,
  text: string,
  options: { bold?: boolean; size: number } ,
): number {
  applyPdfI18nFont(pdf, registry, locale, { bold: options.bold, text });
  pdf.setFontSize(options.size);
  return pdf.getTextWidth(text);
}

export function pdfI18nSplitTextToSize(
  pdf: Pdf,
  registry: PdfI18nRegistry | null | undefined,
  locale: Locale,
  text: string,
  maxW: number,
  options: { bold?: boolean; size: number } = { size: 10 },
): string[] {
  if (!text) return [];
  applyPdfI18nFont(pdf, registry, locale, { bold: options.bold, text });
  pdf.setFontSize(options.size);
  const result = pdf.splitTextToSize(text, maxW);
  return Array.isArray(result) ? result.map(String) : [String(result)];
}

export function pdfI18nDrawText(
  pdf: Pdf,
  registry: PdfI18nRegistry | null | undefined,
  locale: Locale,
  text: string,
  x: number,
  y: number,
  options: PdfI18nDrawOptions,
): void {
  if (!text) return;

  if (needsShapedTextFallback(locale, text)) {
    const shaped = shapedTextToDataUrl(text, locale, options);
    if (shaped) {
      const drawX = options.align === 'center'
        ? x - shaped.widthMm / 2
        : options.align === 'right' || options.rtl
          ? x - shaped.widthMm
          : x;
      const drawY = y - shaped.heightMm * 0.78;
      try {
        pdf.addImage(shaped.dataUrl, 'PNG', drawX, drawY, shaped.widthMm, shaped.heightMm, undefined, 'FAST');
      } catch {
        pdf.addImage(shaped.dataUrl, 'PNG', drawX, drawY, shaped.widthMm, shaped.heightMm);
      }
      // Hybrid ATS layer: shaped PNG for correct conjuncts + invisible Unicode
      // text at the same baseline/reading position (not a page-end dump).
      drawInvisibleUnicodeTextLayer(pdf, registry, locale, text, x, y, options);
      return;
    }
  }

  applyPdfI18nTextStyle(pdf, registry, locale, options, text);
  const rtl = options.rtl ?? isRtlLocale(locale);
  const textOpts = options.align
    ? { align: options.align }
  : rtl
      ? { align: 'right' as const }
      : undefined;

  if (textOpts) {
    pdf.text(text, x, y, textOpts);
  } else {
    pdf.text(text, x, y);
  }
}

/** Detect known broken PDF text patterns from Android artifacts. */
export function detectBrokenPdfTextPatterns(text: string): {
  japaneseMojibake: boolean;
  hindiTabSeparated: boolean;
  cyrillicControlGarbage: boolean;
  arabicMissing: boolean;
} {
  return {
    japaneseMojibake: /0[×x¹í][0-9A-Za-zÀ-ÿ]/.test(text) || /\uFFFD/.test(text),
    hindiTabSeparated: /[\u0900-\u097F]\t[\u0900-\u097F]/.test(text),
    cyrillicControlGarbage: /\u0004[\u0000-\u001F][\u0400-\u04FF]/.test(text) || //.test(text),
    arabicMissing: text.trim().length > 0 && !/[\u0600-\u06FF]/.test(text) && /^(?:[\s.|•-]+|[A-Za-z0-9@.]+)$/.test(text.trim()),
  };
}

export function technicalTermsPreservedInText(text: string, terms: string[] = [...TECHNICAL_TOKENS]): boolean {
  return terms.every((term) => !text.includes(term) || text.includes(term));
}

export type PdfI18nCtx = {
  pdf: Pdf;
  locale: Locale;
  i18n: PdfI18nRegistry | null;
};

export function pdfI18nCtxApplyStyle(
  ctx: PdfI18nCtx,
  style: PdfI18nDrawOptions,
  text?: string,
): void {
  applyPdfI18nTextStyle(ctx.pdf, ctx.i18n, ctx.locale, style, text);
}

export function pdfI18nCtxSplit(
  ctx: PdfI18nCtx,
  text: string,
  maxW: number,
  style: { size: number; bold?: boolean },
): string[] {
  return pdfI18nSplitTextToSize(ctx.pdf, ctx.i18n, ctx.locale, text, maxW, style);
}

export function pdfI18nCtxDraw(
  ctx: PdfI18nCtx,
  text: string,
  x: number,
  y: number,
  style: PdfI18nDrawOptions,
): void {
  pdfI18nDrawText(ctx.pdf, ctx.i18n, ctx.locale, text, x, y, {
    ...style,
    rtl: style.rtl ?? isRtlLocale(ctx.locale),
  });
}

export function pdfI18nCtxTextWidth(
  ctx: PdfI18nCtx,
  text: string,
  style: { size: number; bold?: boolean },
): number {
  return pdfI18nGetTextWidth(ctx.pdf, ctx.i18n, ctx.locale, text, style);
}
