/**
 * Contemporary Bold — dedicated direct jsPDF page-aware renderer (v2 full rebuild).
 *
 * Dark navy full-width header · thin blue accent rule · white body.
 * Direct jsPDF only — no html2canvas, no DOM capture, no canvas slicing.
 *
 * Key guarantees:
 *  • Page 1 is NEVER blank after the header — body starts immediately.
 *  • contentWidth = pageWidth − leftMargin − rightMargin (182 mm).
 *  • Every text draw respects right margin — no clipping.
 *  • cbNormalizePdfText protects GitHub, Node.js, C++17, CI/CD, etc. before
 *    any sentence-boundary fixing.
 *  • Compact mode activates for long CVs, targeting ≤ 4 pages.
 *  • Noto Sans is embedded for full Serbian/Croatian/Bosnian diacritic support.
 */
import { getLocalizedCvLanguageName } from './cv-language-options';
import { getLocalizedCvSkillName } from './cv-skill-options';
import { translations, type Locale } from './i18n/translations';
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
import { drawCircularPdfPhoto, preparePdfCircularPhotoDataUrl } from './pdf-photo';
import { regionSettings, type CVData } from './types';

// ── Page metrics ─────────────────────────────────────────────────────────────
const A4_W = 210;
const A4_H = 297;
const MARGIN_LEFT = 14;
const MARGIN_RIGHT = 14;
const MARGIN_TOP_BODY = 16;
const MARGIN_BOTTOM = 14;
/** Usable content width: every text/drawing must stay within this. */
const CONTENT_W = A4_W - MARGIN_LEFT - MARGIN_RIGHT; // 182 mm
const CONTENT_X = MARGIN_LEFT;

// ── Design palette ───────────────────────────────────────────────────────────
const NAVY: [number, number, number] = [15, 23, 42];
const BLUE: [number, number, number] = [59, 130, 246];
const LIGHT_BLUE: [number, number, number] = [147, 197, 253];
const WHITE: [number, number, number] = [255, 255, 255];
const TEXT_DARK: [number, number, number] = [17, 24, 39];
const BODY_CLR: [number, number, number] = [55, 65, 81];
const MUTED: [number, number, number] = [107, 114, 128];
const CONTACT_CLR: [number, number, number] = [203, 213, 225];
const RULE_CLR: [number, number, number] = [219, 234, 254];
const CHIP_BG: [number, number, number] = [241, 245, 249];
const CHIP_TEXT: [number, number, number] = [51, 65, 85];

// ── Photo ─────────────────────────────────────────────────────────────────────
const PHOTO_R = 14; // circular photo radius in mm

// ── Date column ───────────────────────────────────────────────────────────────
const DATE_COL_W = 38; // reserved right-aligned date width in mm

// ── Skills layout ─────────────────────────────────────────────────────────────
const SKILLS_COL_RATIO = 0.58;
const LANGS_COL_GAP = 6;

// ── Compact mode threshold ───────────────────────────────────────────────────
const COMPACT_SUMMARY_CHARS = 500;
const COMPACT_BULLET_COUNT = 8;
const COMPACT_EXP_COUNT = 3;

type Pdf = InstanceType<typeof import('jspdf').jsPDF>;

// ── Compact-mode layout pack ──────────────────────────────────────────────────
type LayoutPack = {
  bodySize: number;
  bodyLH: number;
  bulletSize: number;
  bulletLH: number;
  sectionH: number;
  entryGap: number;
  paraGap: number;
  afterSummary: number;
  headingSize: number;
  titleSize: number;
  companySize: number;
  dateSize: number;
  chipSize: number;
  chipH: number;
  chipRowH: number;
  langSize: number;
  langLH: number;
};

function normalLayout(): LayoutPack {
  return {
    bodySize: 9.0,
    bodyLH: 3.7,
    bulletSize: 8.8,
    bulletLH: 3.5,
    sectionH: 7.2,
    entryGap: 3.0,
    paraGap: 4.0,
    afterSummary: 4.0,
    headingSize: 8.5,
    titleSize: 10.5,
    companySize: 9.5,
    dateSize: 8.0,
    chipSize: 8.0,
    chipH: 5.0,
    chipRowH: 6.0,
    langSize: 9.0,
    langLH: 4.0,
  };
}

function compactLayout(): LayoutPack {
  return {
    bodySize: 7.8,
    bodyLH: 3.2,
    bulletSize: 7.6,
    bulletLH: 3.0,
    sectionH: 6.2,
    entryGap: 2.0,
    paraGap: 3.0,
    afterSummary: 3.0,
    headingSize: 7.8,
    titleSize: 9.0,
    companySize: 8.5,
    dateSize: 7.5,
    chipSize: 7.5,
    chipH: 4.5,
    chipRowH: 5.5,
    langSize: 8.5,
    langLH: 3.5,
  };
}

/** Detect whether the CV warrants compact layout to target ≤ 4 pages. */
export function cbDetectCompactMode(cv: CVData): boolean {
  const summaryLen = cv.summary?.length ?? 0;
  const bulletCount = cv.experience.reduce((acc, e) => {
    return acc + (e.description?.split('\n').filter((l) => l.trim()).length ?? 0);
  }, 0);
  const expCount = cv.experience.length;
  return summaryLen > COMPACT_SUMMARY_CHARS || bulletCount > COMPACT_BULLET_COUNT || expCount > COMPACT_EXP_COUNT;
}

// ── Context ───────────────────────────────────────────────────────────────────
export type ContemporaryBoldPdfContext = {
  pdf: Pdf;
  cv: CVData;
  locale: Locale;
  labels: ReturnType<typeof getCbPdfLabels>;
  i18n: PdfI18nRegistry;
  unicodeReady: boolean;
  lastTextStyle?: StyleSpec;
  contentX: number;
  contentW: number;
  pageW: number;
  pageH: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  bottomSafeY: number;
  y: number;
  pageIndex: number;
  lp: LayoutPack;
};

type StyleSpec = {
  size: number;
  color: [number, number, number];
  bold?: boolean;
  lh: number;
};

type BulletUnit = { lines: string[] };
type Chip = { text: string; w: number };

export type CbBulletLayout = {
  markerX: number;
  textX: number;
  wrapW: number;
};

/** Embed multilingual Noto families into jsPDF. */
export async function cbRegisterUnicodeFonts(pdf: Pdf): Promise<boolean> {
  const i18n = await registerPdfI18nFonts(pdf);
  return i18n.latinReady;
}

// ── Labels ────────────────────────────────────────────────────────────────────
export function getCbPdfLabels(locale: Locale) {
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

// ── Text normalization ────────────────────────────────────────────────────────
/**
 * PDF-only text normalization. Does NOT mutate saved CV data.
 *
 * Strategy:
 *  1. Explicitly protect technical terms with internal uppercase (GitHub, Node.js, etc.)
 *  2. Auto-protect remaining UpperCamelCase words (e.g. FooBar, MongoDB-like terms)
 *  3. Protect email addresses
 *  4. Apply dot-based sentence-boundary fixes
 *  5. Apply narrow particle-based fix (only 2–4-char particles at \b)
 *  6. Restore all protected tokens
 *
 * This order ensures GitHub → never becomes "Git. Hub".
 */
export function cbNormalizePdfText(text: string, locale: Locale = 'en'): string {
  if (!text) return '';
  let out = text.replace(/\r\n/g, '\n');
  if (!shouldApplyLatinPdfSentenceFixes(locale, text)) {
    return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
  }

  // ── Step 1: Explicit technical term protection ──────────────────────────────
  // Order matters: longer/more-specific tokens first (GitHub Actions before GitHub).
  const protect: Array<{ token: string; stub: string }> = [
    // .js-suffix frameworks
    { token: 'Node.js', stub: '\u0001T000\u0001' },
    { token: 'node.js', stub: '\u0001T001\u0001' },
    { token: 'React.js', stub: '\u0001T002\u0001' },
    { token: 'Next.js', stub: '\u0001T003\u0001' },
    { token: 'Vue.js', stub: '\u0001T004\u0001' },
    { token: 'Express.js', stub: '\u0001T005\u0001' },
    { token: 'Angular.js', stub: '\u0001T006\u0001' },
    { token: 'Nuxt.js', stub: '\u0001T007\u0001' },
    { token: 'Ember.js', stub: '\u0001T008\u0001' },
    // Slash-separated tokens
    { token: 'CI/CD', stub: '\u0001T009\u0001' },
    { token: 'REST APIs', stub: '\u0001T010\u0001' },
    { token: 'REST API', stub: '\u0001T011\u0001' },
    { token: 'nlohmann/json', stub: '\u0001T012\u0001' },
    { token: 'S3/CloudFront', stub: '\u0001T013\u0001' },
    // C-family (longer variants first)
    { token: 'C++17', stub: '\u0001T014\u0001' },
    { token: 'C++14', stub: '\u0001T015\u0001' },
    { token: 'C++11', stub: '\u0001T016\u0001' },
    { token: 'C++', stub: '\u0001T017\u0001' },
    { token: 'C#', stub: '\u0001T018\u0001' },
    { token: '.NET Core', stub: '\u0001T019\u0001' },
    { token: '.NET', stub: '\u0001T020\u0001' },
    { token: 'libcurl', stub: '\u0001T021\u0001' },
    // Languages
    { token: 'TypeScript', stub: '\u0001T022\u0001' },
    { token: 'JavaScript', stub: '\u0001T023\u0001' },
    { token: 'PowerShell', stub: '\u0001T024\u0001' },
    { token: 'CoffeeScript', stub: '\u0001T025\u0001' },
    // Git platforms (longer first)
    { token: 'GitHub Actions', stub: '\u0001T026\u0001' },
    { token: 'GitHub Copilot', stub: '\u0001T027\u0001' },
    { token: 'GitHub', stub: '\u0001T028\u0001' },
    { token: 'GitLab CI', stub: '\u0001T029\u0001' },
    { token: 'GitLab', stub: '\u0001T030\u0001' },
    { token: 'GitOps', stub: '\u0001T031\u0001' },
    // Databases
    { token: 'MongoDB', stub: '\u0001T032\u0001' },
    { token: 'PostgreSQL', stub: '\u0001T033\u0001' },
    { token: 'MySQL', stub: '\u0001T034\u0001' },
    { token: 'SQLite', stub: '\u0001T035\u0001' },
    { token: 'GraphQL', stub: '\u0001T036\u0001' },
    { token: 'MariaDB', stub: '\u0001T037\u0001' },
    { token: 'DynamoDB', stub: '\u0001T038\u0001' },
    { token: 'Cassandra', stub: '\u0001T039\u0001' },
    // Web/APIs
    { token: 'WebSockets', stub: '\u0001T040\u0001' },
    { token: 'WebSocket', stub: '\u0001T041\u0001' },
    { token: 'WebAssembly', stub: '\u0001T042\u0001' },
    // Apple platforms
    { token: 'SwiftUI', stub: '\u0001T043\u0001' },
    { token: 'UIKit', stub: '\u0001T044\u0001' },
    { token: 'AppKit', stub: '\u0001T045\u0001' },
    { token: 'CoreData', stub: '\u0001T046\u0001' },
    { token: 'CoreML', stub: '\u0001T047\u0001' },
    { token: 'SwiftData', stub: '\u0001T048\u0001' },
    { token: 'ARKit', stub: '\u0001T049\u0001' },
    { token: 'MapKit', stub: '\u0001T050\u0001' },
    { token: 'macOS', stub: '\u0001T051\u0001' },
    { token: 'iOS', stub: '\u0001T052\u0001' },
    { token: 'tvOS', stub: '\u0001T053\u0001' },
    { token: 'watchOS', stub: '\u0001T054\u0001' },
    { token: 'iCloud', stub: '\u0001T055\u0001' },
    { token: 'iPhone', stub: '\u0001T056\u0001' },
    { token: 'iPad', stub: '\u0001T057\u0001' },
    { token: 'MacBook', stub: '\u0001T058\u0001' },
    // Cloud / DevOps
    { token: 'Firebase', stub: '\u0001T059\u0001' },
    { token: 'Firestore', stub: '\u0001T060\u0001' },
    { token: 'DevOps', stub: '\u0001T061\u0001' },
    { token: 'DataOps', stub: '\u0001T062\u0001' },
    { token: 'MLOps', stub: '\u0001T063\u0001' },
    { token: 'Kubernetes', stub: '\u0001T064\u0001' },
    { token: 'OpenShift', stub: '\u0001T065\u0001' },
    { token: 'OpenAI', stub: '\u0001T066\u0001' },
    { token: 'OpenGL', stub: '\u0001T067\u0001' },
    { token: 'OpenCV', stub: '\u0001T068\u0001' },
    { token: 'OpenSSL', stub: '\u0001T069\u0001' },
    // JS ecosystem
    { token: 'TailwindCSS', stub: '\u0001T070\u0001' },
    { token: 'WordPress', stub: '\u0001T071\u0001' },
    { token: 'WooCommerce', stub: '\u0001T072\u0001' },
    { token: 'LangChain', stub: '\u0001T073\u0001' },
    { token: 'NuGet', stub: '\u0001T074\u0001' },
    { token: 'ChatGPT', stub: '\u0001T075\u0001' },
    // AI/ML
    { token: 'NumPy', stub: '\u0001T076\u0001' },
    { token: 'TensorFlow', stub: '\u0001T077\u0001' },
    { token: 'PyTorch', stub: '\u0001T078\u0001' },
    { token: 'scikit-learn', stub: '\u0001T079\u0001' },
    // Social/networks
    { token: 'LinkedIn', stub: '\u0001T080\u0001' },
    { token: 'StackOverflow', stub: '\u0001T081\u0001' },
    // IDEs
    { token: 'IntelliJ IDEA', stub: '\u0001T082\u0001' },
    { token: 'IntelliJ', stub: '\u0001T083\u0001' },
    { token: 'PyCharm', stub: '\u0001T084\u0001' },
    { token: 'VS Code', stub: '\u0001T085\u0001' },
    // Java/JVM
    { token: 'HashMap', stub: '\u0001T086\u0001' },
    { token: 'ArrayList', stub: '\u0001T087\u0001' },
    { token: 'StringBuilder', stub: '\u0001T088\u0001' },
    { token: 'SpringBoot', stub: '\u0001T089\u0001' },
    { token: 'Spring Boot', stub: '\u0001T090\u0001' },
  ];
  for (const p of protect) out = out.split(p.token).join(p.stub);

  // ── Step 2: Auto-protect remaining UpperCamelCase words ─────────────────────
  // Matches: [A-Z][a-z]+([A-Z][a-z]+)+ i.e. two or more pascal-case segments.
  // This catches FooBar, McDonald, Elasticsearch, etc. not in the explicit list.
  // Does NOT match daIskusan (starts lowercase) — those need the gluing fix below.
  const autoCamel: string[] = [];
  out = out.replace(/\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g, (m) => {
    const stub = `\u0002AC${autoCamel.length}\u0002`;
    autoCamel.push(m);
    return stub;
  });

  // ── Step 3: Protect emails ────────────────────────────────────────────────────
  const emails: string[] = [];
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, (m) => {
    const stub = `\u0003EM${emails.length}\u0003`;
    emails.push(m);
    return stub;
  });

  // ── Step 4: Dot-based sentence-boundary fixes ─────────────────────────────────
  // e.g. "users.Led" → "users. Led"   "napreduje.Iskusan" → "napreduje. Iskusan"
  const latLo = 'a-z\u0161\u0111\u010d\u0107\u017e';
  const latHi = 'A-Z\u0160\u0110\u010c\u0106\u017d';
  out = out.replace(new RegExp(`([${latLo}])\\.([${latHi}])`, 'g'), '$1. $2');
  out = out.replace(new RegExp(`([${latLo}])\\.([${latHi}])`, 'g'), '$1. $2');
  out = out.replace(new RegExp(`\\.([${latLo}]{3,})\\.(\\s*)([${latHi}])`, 'g'), '. $1. $3');
  out = out.replace(new RegExp(`([${latLo}])\\.([${latHi}])`, 'g'), '$1. $2');

  // ── Step 5: Particle-based fix (narrow: 2–4 char lowercase prefix + word boundary) ──
  // e.g. "daIskusan" → "da. Iskusan"
  // Uses \b so it cannot fire in the middle of a word like GitHub (no \b before 'it').
  out = out.replace(
    new RegExp(`\\b([${latLo}]{2,4})([${latHi}][${latLo}]{2,})`, 'g'),
    '$1. $2',
  );

  // ── Step 6: Restore all protected tokens ─────────────────────────────────────
  for (const p of protect) out = out.split(p.stub).join(p.token);
  autoCamel.forEach((t, i) => { out = out.split(`\u0002AC${i}\u0002`).join(t); });
  emails.forEach((e, i) => { out = out.split(`\u0003EM${i}\u0003`).join(e); });

  return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function applyStyle(ctx: ContemporaryBoldPdfContext, spec: StyleSpec, text?: string): void {
  ctx.lastTextStyle = spec;
  pdfI18nCtxApplyStyle(ctx, { size: spec.size, color: spec.color, bold: spec.bold }, text);
}

function drawText(
  ctx: ContemporaryBoldPdfContext,
  text: string,
  x: number,
  y: number,
  spec: StyleSpec,
  extra: { align?: 'left' | 'center' | 'right' } = {},
): void {
  pdfI18nCtxDraw(ctx, text, x, y, {
    size: spec.size,
    color: spec.color,
    bold: spec.bold,
    rtl: isRtlLocale(ctx.locale),
    align: extra.align ?? (isRtlLocale(ctx.locale) ? 'right' : 'left'),
  });
}

function freshCap(ctx: ContemporaryBoldPdfContext): number {
  return ctx.bottomSafeY - ctx.marginTop;
}

// ── Right-margin guards ───────────────────────────────────────────────────────
/**
 * Return the maximum text/content width allowed starting at x.
 * Ensures x + result <= pageWidth − rightMargin.
 */
export function cbSafeMaxWidth(ctx: ContemporaryBoldPdfContext, x: number): number {
  const safeRight = ctx.pageW - ctx.marginRight;
  return Math.max(1, safeRight - x);
}

// ── Context factory ───────────────────────────────────────────────────────────
export function cbCreateContext(
  pdf: Pdf,
  cv: CVData,
  locale: Locale,
  i18n: PdfI18nRegistry,
): ContemporaryBoldPdfContext {
  const compact = cbDetectCompactMode(cv);
  return {
    pdf,
    cv,
    locale,
    labels: getCbPdfLabels(locale),
    i18n,
    unicodeReady: i18n.latinReady,
    contentX: CONTENT_X,
    contentW: CONTENT_W,
    pageW: A4_W,
    pageH: A4_H,
    marginLeft: MARGIN_LEFT,
    marginRight: MARGIN_RIGHT,
    marginTop: MARGIN_TOP_BODY,
    marginBottom: MARGIN_BOTTOM,
    bottomSafeY: A4_H - MARGIN_BOTTOM,
    y: MARGIN_TOP_BODY,
    pageIndex: 0,
    lp: compact ? compactLayout() : normalLayout(),
  };
}

// ── Page management ───────────────────────────────────────────────────────────
export function cbAddPage(ctx: ContemporaryBoldPdfContext): void {
  ctx.pdf.addPage();
  ctx.pageIndex += 1;
  ctx.y = ctx.marginTop;
}

export function cbMoveToNextPage(ctx: ContemporaryBoldPdfContext): void {
  cbAddPage(ctx);
}

export function cbEnsureSpace(ctx: ContemporaryBoldPdfContext, h: number): void {
  if (ctx.y + h <= ctx.bottomSafeY) return;
  cbAddPage(ctx);
}

function cbFreshPageIfNeeded(ctx: ContemporaryBoldPdfContext, h: number): void {
  if (h > freshCap(ctx)) return;
  if (ctx.y + h > ctx.bottomSafeY) cbAddPage(ctx);
}

// ── Text measurement ──────────────────────────────────────────────────────────
function wrapLines(
  ctx: ContemporaryBoldPdfContext,
  text: string,
  maxW: number,
  spec?: Pick<StyleSpec, 'size' | 'bold'>,
): string[] {
  const t = cbNormalizePdfText(text, ctx.locale);
  if (!t) return [];
  const safeW = Math.min(maxW, cbSafeMaxWidth(ctx, ctx.contentX));
  const style = spec ?? ctx.lastTextStyle ?? { size: 9, bold: false };
  return pdfI18nCtxSplit(ctx, t, safeW, { size: style.size, bold: style.bold });
}

export function cbMeasureWrappedTextHeight(
  ctx: ContemporaryBoldPdfContext,
  text: string,
  maxW: number,
  lineH: number,
): number {
  return wrapLines(ctx, text, maxW).length * lineH;
}

export function cbMeasureBulletHeight(lineCount: number, lh: number): number {
  if (lineCount <= 0) return 0;
  return lineCount * lh + 0.3;
}

// ── Bullet layout ─────────────────────────────────────────────────────────────
function buildBulletLayout(ctx: ContemporaryBoldPdfContext): CbBulletLayout {
  const markerSpec: StyleSpec = { size: ctx.lp.bulletSize, color: BLUE, lh: ctx.lp.bulletLH };
  applyStyle(ctx, markerSpec, '-');
  const markerW = pdfI18nCtxTextWidth(ctx, '-', { size: markerSpec.size, bold: false });
  const markerX = ctx.contentX;
  const textX = markerX + markerW + 1.5;
  // wrapW must not exceed right margin
  const wrapW = cbSafeMaxWidth(ctx, textX);
  return { markerX, textX, wrapW: Math.max(4, wrapW) };
}

function splitBullets(raw: string, locale: Locale): string[] {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => cbNormalizePdfText(l.replace(/^(?:[-*]|\u2022|\d+\.)\s*/, ''), locale))
    .filter(Boolean);
}

function buildBulletUnits(ctx: ContemporaryBoldPdfContext, raw: string): BulletUnit[] {
  const layout = buildBulletLayout(ctx);
  const bulletSpec: StyleSpec = { size: ctx.lp.bulletSize, color: BODY_CLR, lh: ctx.lp.bulletLH };
  return splitBullets(raw, ctx.locale).map((b) => ({
    lines: wrapLines(ctx, b, layout.wrapW, bulletSpec),
  }));
}

// ── Header ────────────────────────────────────────────────────────────────────
function headerContacts(ctx: ContemporaryBoldPdfContext): string[] {
  const region = regionSettings[ctx.cv.region];
  return [
    ctx.cv.personal.email,
    ctx.cv.personal.phone,
    region.showAddress ? ctx.cv.personal.address : '',
  ].filter(Boolean) as string[];
}

/**
 * Dark navy full-width header with name/title/contacts and optional circular photo.
 * Sets ctx.y to body start immediately — page 1 is NEVER left blank after this.
 */
export function cbDrawHeader(
  ctx: ContemporaryBoldPdfContext,
  photoDataUrl: string | null,
): void {
  const headerH = photoDataUrl ? 50 : 40;

  // Navy background
  ctx.pdf.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  ctx.pdf.rect(0, 0, A4_W, headerH, 'F');

  // Text area: reserve space for photo on the right
  const textLeft = MARGIN_LEFT;
  const photoAreaW = photoDataUrl ? PHOTO_R * 2 + 10 : 0;
  const textMaxW = Math.min(CONTENT_W - photoAreaW, A4_W - MARGIN_RIGHT - photoAreaW - textLeft);
  let ty = 10;

  // Name
  const nameSpec: StyleSpec = { size: 17, color: WHITE, bold: true, lh: 6 };
  applyStyle(ctx, nameSpec, ctx.cv.personal.fullName || 'Your Name');
  const nameLines = wrapLines(ctx, ctx.cv.personal.fullName || 'Your Name', textMaxW, nameSpec).slice(0, 2);
  for (const ln of nameLines) {
    drawText(ctx, ln, textLeft, ty + 4.5, nameSpec);
    ty += 5.8;
  }

  // Job title
  if (ctx.cv.personal.jobTitle) {
    const titleSpec: StyleSpec = { size: 10, color: LIGHT_BLUE, bold: true, lh: 4 };
    applyStyle(ctx, titleSpec, ctx.cv.personal.jobTitle);
    const titleLines = wrapLines(ctx, ctx.cv.personal.jobTitle, textMaxW, titleSpec).slice(0, 2);
    for (const ln of titleLines) {
      drawText(ctx, ln, textLeft, ty + 3, titleSpec);
      ty += 4.2;
    }
  }

  // Contact line
  const contacts = headerContacts(ctx);
  if (contacts.length) {
    ty += 2;
    const contactSpec: StyleSpec = { size: 8, color: CONTACT_CLR, lh: 3.4 };
    applyStyle(ctx, contactSpec);
    const contactStr = contacts.join('  |  ');
    const contactLines = wrapLines(ctx, contactStr, textMaxW, contactSpec).slice(0, 2);
    for (const ln of contactLines) {
      drawText(ctx, ln, textLeft, ty + 2.5, contactSpec);
      ty += 3.5;
    }
  }

  // Circular photo (top-right)
  if (photoDataUrl) {
    const cx = A4_W - MARGIN_RIGHT - PHOTO_R;
    const cy = headerH / 2;
    try {
      drawCircularPdfPhoto(ctx.pdf, photoDataUrl, cx, cy, PHOTO_R, {
        outerFill: WHITE,
        outerRadiusDelta: 0.6,
        borders: [{ color: [30, 41, 59], lineWidth: 1.8, radiusDelta: 0.3 }],
      });
    } catch {
      ctx.pdf.setDrawColor(30, 41, 59);
      ctx.pdf.setLineWidth(1.8);
      ctx.pdf.circle(cx, cy, PHOTO_R, 'S');
    }
  }

  // Blue accent rule under the header
  ctx.pdf.setFillColor(BLUE[0], BLUE[1], BLUE[2]);
  ctx.pdf.rect(0, headerH, A4_W, 0.7, 'F');

  // CRITICAL: body starts immediately — never leave page 1 blank after header.
  ctx.y = headerH + 10;
}

// ── Section heading ───────────────────────────────────────────────────────────
export function cbDrawSectionHeading(ctx: ContemporaryBoldPdfContext, label: string): void {
  cbEnsureSpace(ctx, ctx.lp.sectionH + 2);
  const spec: StyleSpec = { size: ctx.lp.headingSize, color: NAVY, bold: true, lh: 3.5 };
  applyStyle(ctx, spec, label);
  drawText(ctx, label.toUpperCase(), ctx.contentX, ctx.y + 3, spec);
  ctx.y += 4.2;
  ctx.pdf.setDrawColor(RULE_CLR[0], RULE_CLR[1], RULE_CLR[2]);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.contentX, ctx.y, ctx.contentX + ctx.contentW, ctx.y);
  ctx.y += 3.0;
}

// ── Wrapped paragraph ─────────────────────────────────────────────────────────
export function cbDrawWrappedParagraph(
  ctx: ContemporaryBoldPdfContext,
  lines: string[],
  spec: StyleSpec,
  opts: { x?: number } = {},
): void {
  const x = opts.x ?? ctx.contentX;
  for (const line of lines) {
    cbEnsureSpace(ctx, spec.lh);
    applyStyle(ctx, spec, line);
    drawText(ctx, line, x, ctx.y + spec.size * 0.32, spec);
    ctx.y += spec.lh;
  }
}

// ── Professional Summary ──────────────────────────────────────────────────────
export function cbDrawSummary(ctx: ContemporaryBoldPdfContext): void {
  if (!ctx.cv.summary?.trim()) return;

  const spec: StyleSpec = { size: ctx.lp.bodySize, color: BODY_CLR, lh: ctx.lp.bodyLH };
  const paragraphs = ctx.cv.summary.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  const blocks = paragraphs.length > 0 ? paragraphs : [ctx.cv.summary];
  const linesByBlock = blocks.map((b) => wrapLines(ctx, b, ctx.contentW));
  const totalLines = linesByBlock.reduce((s, ls) => s + ls.length, 0);
  if (totalLines === 0) return;

  const previewLines = Math.min(3, totalLines);
  cbFreshPageIfNeeded(ctx, ctx.lp.sectionH + previewLines * spec.lh);
  cbDrawSectionHeading(ctx, ctx.labels.summary);

  linesByBlock.forEach((lines, idx) => {
    cbDrawWrappedParagraph(ctx, lines, spec);
    if (idx < linesByBlock.length - 1) ctx.y += ctx.lp.paraGap * 0.5;
  });
  ctx.y += ctx.lp.afterSummary;
}

// ── Work Experience ───────────────────────────────────────────────────────────
export function cbMeasureExperienceEntryLeadHeight(
  ctx: ContemporaryBoldPdfContext,
  entry: CVData['experience'][number],
): number {
  applyStyle(ctx, { size: ctx.lp.titleSize, color: TEXT_DARK, bold: true, lh: ctx.lp.bodyLH });
  const titleW = cbSafeMaxWidth(ctx, ctx.contentX) - DATE_COL_W;
  const posLines = wrapLines(ctx, entry.position || '', Math.max(4, titleW));
  const companyH = entry.company ? ctx.lp.companySize * 0.4 + 3.5 : 0;
  return Math.max(ctx.lp.bodyLH, posLines.length * ctx.lp.bodyLH) + companyH + 2;
}

function drawExperienceLead(
  ctx: ContemporaryBoldPdfContext,
  entry: CVData['experience'][number],
): void {
  const date = [entry.startDate, entry.isPresent ? ctx.labels.present : entry.endDate]
    .filter(Boolean)
    .join(' – ');

  // Title (position)
  const titleW = cbSafeMaxWidth(ctx, ctx.contentX) - DATE_COL_W;
  const titleSpec: StyleSpec = { size: ctx.lp.titleSize, color: TEXT_DARK, bold: true, lh: ctx.lp.bodyLH };
  applyStyle(ctx, titleSpec);
  const posLines = wrapLines(ctx, entry.position || '', Math.max(4, titleW), titleSpec);
  const startY = ctx.y;
  let ty = startY;
  for (const ln of posLines) {
    drawText(ctx, ln, ctx.contentX, ty + ctx.lp.titleSize * 0.32, titleSpec);
    ty += ctx.lp.bodyLH;
  }

  // Date — right-aligned within content area
  if (date) {
    const dateSpec: StyleSpec = { size: ctx.lp.dateSize, color: MUTED, lh: ctx.lp.bodyLH * 0.9 };
    applyStyle(ctx, dateSpec, date);
    const dw = pdfI18nCtxTextWidth(ctx, date, { size: dateSpec.size, bold: false });
    const dateX = ctx.contentX + ctx.contentW - dw;
    drawText(ctx, date, dateX, startY + ctx.lp.titleSize * 0.32, dateSpec, { align: 'right' });
  }

  // Company — blue accent below title
  if (entry.company) {
    const companySpec: StyleSpec = { size: ctx.lp.companySize, color: BLUE, bold: true, lh: ctx.lp.bodyLH };
    const company = cbNormalizePdfText(entry.company, ctx.locale);
    applyStyle(ctx, companySpec, company);
    drawText(ctx, company, ctx.contentX, ty + ctx.lp.companySize * 0.32, companySpec);
    ty += ctx.lp.bodyLH * 1.1;
  }

  ctx.y = ty + 1.5;
}

function drawContinuation(ctx: ContemporaryBoldPdfContext, entry: CVData['experience'][number]): void {
  cbEnsureSpace(ctx, 5);
  const role = entry.position || entry.company || 'Experience';
  const contSpec: StyleSpec = { size: ctx.lp.dateSize, color: MUTED, bold: true, lh: ctx.lp.bodyLH };
  const contText = `${cbNormalizePdfText(role, ctx.locale)} (continued)`;
  applyStyle(ctx, contSpec, contText);
  drawText(ctx, contText, ctx.contentX, ctx.y + 2.5, contSpec);
  ctx.y += 4.5;
}

export function cbDrawWrappedBullet(
  ctx: ContemporaryBoldPdfContext,
  lines: string[],
  layout: CbBulletLayout,
  opts: { drawMarker?: boolean } = {},
): void {
  const drawMarker = opts.drawMarker ?? true;
  const spec: StyleSpec = { size: ctx.lp.bulletSize, color: BODY_CLR, lh: ctx.lp.bulletLH };
  const markerSpec: StyleSpec = { size: ctx.lp.bulletSize, color: BLUE, lh: ctx.lp.bulletLH };
  for (let i = 0; i < lines.length; i += 1) {
    cbEnsureSpace(ctx, ctx.lp.bulletLH);
    // Marker only on first visual line — true hanging indent, no duplicate markers.
    if (i === 0 && drawMarker) {
      applyStyle(ctx, markerSpec, '-');
      drawText(ctx, '-', layout.markerX, ctx.y + ctx.lp.bulletSize * 0.32, markerSpec);
    }
    applyStyle(ctx, spec, lines[i]!);
    drawText(ctx, lines[i]!, layout.textX, ctx.y + spec.size * 0.32, spec);
    ctx.y += ctx.lp.bulletLH;
  }
}

function drawBulletUnit(
  ctx: ContemporaryBoldPdfContext,
  unit: BulletUnit,
  entry: CVData['experience'][number],
  cont: { shown: boolean },
): void {
  if (!unit.lines.length) return;
  const layout = buildBulletLayout(ctx);
  const h = cbMeasureBulletHeight(unit.lines.length, ctx.lp.bulletLH);

  if (ctx.y + h > ctx.bottomSafeY && h <= freshCap(ctx)) {
    cbAddPage(ctx);
    if (!cont.shown) { drawContinuation(ctx, entry); cont.shown = true; }
  }

  let idx = 0;
  while (idx < unit.lines.length) {
    const room = Math.floor((ctx.bottomSafeY - ctx.y) / ctx.lp.bulletLH);
    if (room <= 0) {
      cbAddPage(ctx);
      if (!cont.shown) { drawContinuation(ctx, entry); cont.shown = true; }
      continue;
    }
    const take = Math.min(unit.lines.length - idx, room);
    cbDrawWrappedBullet(ctx, unit.lines.slice(idx, idx + take), layout, { drawMarker: idx === 0 });
    idx += take;
    if (idx < unit.lines.length) {
      cbAddPage(ctx);
      if (!cont.shown) { drawContinuation(ctx, entry); cont.shown = true; }
    }
  }
  ctx.y += 0.3;
}

export function cbDrawExperienceEntry(
  ctx: ContemporaryBoldPdfContext,
  entry: CVData['experience'][number],
): void {
  const units = buildBulletUnits(ctx, entry.description || '');
  const leadH = cbMeasureExperienceEntryLeadHeight(ctx, entry);
  const firstBH = units[0] ? cbMeasureBulletHeight(units[0].lines.length, ctx.lp.bulletLH) : 0;
  cbFreshPageIfNeeded(ctx, leadH + Math.min(firstBH, ctx.lp.bulletLH * 2));

  drawExperienceLead(ctx, entry);
  const cont = { shown: false };
  for (const unit of units) drawBulletUnit(ctx, unit, entry, cont);
  ctx.y += ctx.lp.entryGap;
}

export function cbDrawExperienceSection(ctx: ContemporaryBoldPdfContext): void {
  if (!ctx.cv.experience.length) return;
  const first = ctx.cv.experience[0]!;
  const leadH = cbMeasureExperienceEntryLeadHeight(ctx, first);
  const units = buildBulletUnits(ctx, first.description || '');
  const firstBH = units[0] ? cbMeasureBulletHeight(units[0].lines.length, ctx.lp.bulletLH) : 0;
  cbFreshPageIfNeeded(ctx, ctx.lp.sectionH + leadH + Math.min(firstBH, ctx.lp.bulletLH * 2));
  cbDrawSectionHeading(ctx, ctx.labels.experience);
  for (const entry of ctx.cv.experience) cbDrawExperienceEntry(ctx, entry);
}

// ── Education ─────────────────────────────────────────────────────────────────
function educationEntryH(ctx: ContemporaryBoldPdfContext, edu: CVData['education'][number]): number {
  const dLines = wrapLines(ctx, edu.degree || '', ctx.contentW - DATE_COL_W);
  const schoolH = edu.school ? ctx.lp.bodyLH + 2 : 0;
  return Math.max(ctx.lp.bodyLH, dLines.length * ctx.lp.bodyLH) + schoolH + 3;
}

function measureEducationH(ctx: ContemporaryBoldPdfContext): number {
  if (!ctx.cv.education.length) return 0;
  let h = ctx.lp.sectionH;
  for (const e of ctx.cv.education) h += educationEntryH(ctx, e);
  return h + 2;
}

function drawEducationEntry(ctx: ContemporaryBoldPdfContext, edu: CVData['education'][number]): void {
  cbFreshPageIfNeeded(ctx, educationEntryH(ctx, edu));
  const degreeSpec: StyleSpec = { size: ctx.lp.titleSize, color: TEXT_DARK, bold: true, lh: ctx.lp.bodyLH };
  applyStyle(ctx, degreeSpec);
  const dLines = wrapLines(ctx, edu.degree || '', ctx.contentW - DATE_COL_W, degreeSpec);
  const startY = ctx.y;
  let lineY = startY;
  for (const ln of dLines) {
    drawText(ctx, ln, ctx.contentX, lineY + ctx.lp.titleSize * 0.32, degreeSpec);
    lineY += ctx.lp.bodyLH;
  }

  const dateText = [edu.startDate, edu.endDate].filter(Boolean).join(' – ');
  if (dateText) {
    const dateSpec: StyleSpec = { size: ctx.lp.dateSize, color: MUTED, lh: ctx.lp.bodyLH };
    applyStyle(ctx, dateSpec, dateText);
    const dw = pdfI18nCtxTextWidth(ctx, dateText, { size: dateSpec.size, bold: false });
    drawText(ctx, dateText, ctx.contentX + ctx.contentW - dw, startY + ctx.lp.titleSize * 0.32, dateSpec, { align: 'right' });
  }
  ctx.y = lineY + 0.3;

  if (edu.school) {
    const schoolSpec: StyleSpec = { size: ctx.lp.companySize, color: MUTED, lh: ctx.lp.bodyLH };
    const school = cbNormalizePdfText(edu.school, ctx.locale);
    applyStyle(ctx, schoolSpec, school);
    drawText(ctx, school, ctx.contentX, ctx.y + ctx.lp.companySize * 0.32, schoolSpec);
    ctx.y += ctx.lp.bodyLH + 1;
  }
  ctx.y += 2;
}

export function cbDrawEducationSection(ctx: ContemporaryBoldPdfContext): void {
  if (!ctx.cv.education.length) return;
  cbFreshPageIfNeeded(ctx, ctx.lp.sectionH + educationEntryH(ctx, ctx.cv.education[0]!));
  cbDrawSectionHeading(ctx, ctx.labels.education);
  for (const edu of ctx.cv.education) drawEducationEntry(ctx, edu);
}

// ── Skills + Languages ────────────────────────────────────────────────────────
function measureSkillsH(ctx: ContemporaryBoldPdfContext, colW: number): number {
  if (!ctx.cv.skills.length) return 0;
  const chips = layoutChips(ctx, colW);
  return ctx.lp.sectionH + measureChipRowsH(chips, colW, ctx.lp.chipRowH) + 2;
}

function measureLangsH(ctx: ContemporaryBoldPdfContext): number {
  if (!ctx.cv.languages.length) return 0;
  return ctx.lp.sectionH + ctx.cv.languages.length * ctx.lp.langLH + 2;
}

function layoutChips(ctx: ContemporaryBoldPdfContext, maxW: number): Chip[] {
  const chipSpec: StyleSpec = { size: ctx.lp.chipSize, color: CHIP_TEXT, lh: 3 };
  applyStyle(ctx, chipSpec);
  return ctx.cv.skills.map((raw) => {
    const text = getLocalizedCvSkillName(raw, ctx.locale) || raw;
    const w = Math.min(maxW, pdfI18nCtxTextWidth(ctx, text, { size: chipSpec.size, bold: false }) + 5);
    return { text, w };
  });
}

function measureChipRowsH(chips: Chip[], maxW: number, chipRowH: number): number {
  let x = 0;
  let rows = 1;
  for (const chip of chips) {
    if (x > 0 && x + chip.w > maxW) { rows += 1; x = 0; }
    x += chip.w + 2;
  }
  return rows * chipRowH;
}

function drawSkillChips(ctx: ContemporaryBoldPdfContext, colX: number, colW: number, startY: number): number {
  if (!ctx.cv.skills.length) return startY;
  const savedY = ctx.y;
  ctx.y = startY;
  cbDrawSectionHeading(ctx, ctx.labels.skills);
  const chips = layoutChips(ctx, colW);
  const rowH = ctx.lp.chipRowH;
  let x = colX;
  let rowY = ctx.y;
  for (const chip of chips) {
    if (x > colX && x + chip.w > colX + colW) { rowY += rowH; x = colX; }
    ctx.pdf.setFillColor(CHIP_BG[0], CHIP_BG[1], CHIP_BG[2]);
    ctx.pdf.setDrawColor(RULE_CLR[0], RULE_CLR[1], RULE_CLR[2]);
    ctx.pdf.setLineWidth(0.15);
    ctx.pdf.rect(x, rowY, chip.w, ctx.lp.chipH, 'FD');
    const chipSpec: StyleSpec = { size: ctx.lp.chipSize, color: CHIP_TEXT, lh: 3 };
    applyStyle(ctx, chipSpec, chip.text);
    drawText(ctx, chip.text, x + 2.2, rowY + ctx.lp.chipH * 0.68, chipSpec);
    x += chip.w + 2;
  }
  const endY = rowY + rowH + 1;
  ctx.y = savedY;
  return endY;
}

function drawLanguagesCol(ctx: ContemporaryBoldPdfContext, colX: number, colW: number, startY: number): number {
  if (!ctx.cv.languages.length) return startY;
  const savedY = ctx.y;
  ctx.y = startY;
  cbDrawSectionHeading(ctx, ctx.labels.languages);
  let rowY = ctx.y;
  for (const lang of ctx.cv.languages) {
    const name = getLocalizedCvLanguageName(lang.name, ctx.locale) || lang.name;
    const nameSpec: StyleSpec = { size: ctx.lp.langSize, color: BODY_CLR, lh: ctx.lp.langLH };
    applyStyle(ctx, nameSpec, name);
    drawText(ctx, name, colX, rowY + ctx.lp.langSize * 0.32, nameSpec);
    if (lang.level) {
      const levelText = `/ ${lang.level}`;
      const levelSpec: StyleSpec = { size: ctx.lp.dateSize, color: MUTED, lh: ctx.lp.langLH };
      applyStyle(ctx, levelSpec, levelText);
      const lw = pdfI18nCtxTextWidth(ctx, levelText, { size: levelSpec.size, bold: false });
      drawText(ctx, levelText, colX + colW - lw, rowY + ctx.lp.langSize * 0.32, levelSpec, { align: 'right' });
    }
    rowY += ctx.lp.langLH;
  }
  ctx.y = savedY;
  return rowY + 1.5;
}

export function cbDrawSkillsLanguagesGroup(ctx: ContemporaryBoldPdfContext): void {
  const hasSkills = ctx.cv.skills.length > 0;
  const hasLangs = ctx.cv.languages.length > 0;
  if (!hasSkills && !hasLangs) return;

  const skillsW = hasLangs ? ctx.contentW * SKILLS_COL_RATIO : ctx.contentW;
  const langsW = hasSkills ? ctx.contentW * (1 - SKILLS_COL_RATIO) - LANGS_COL_GAP : ctx.contentW;
  const skillsX = ctx.contentX;
  const langsX = ctx.contentX + skillsW + LANGS_COL_GAP;

  const skillsH = hasSkills ? measureSkillsH(ctx, skillsW) : 0;
  const langsH = hasLangs ? measureLangsH(ctx) : 0;
  const combined = Math.max(skillsH, langsH);

  if (combined > 0 && combined <= freshCap(ctx) && ctx.y + combined > ctx.bottomSafeY) {
    cbAddPage(ctx);
  }

  const startY = ctx.y;
  let skillsEnd = startY;
  let langsEnd = startY;
  if (hasSkills) skillsEnd = drawSkillChips(ctx, skillsX, skillsW, startY);
  if (hasLangs) langsEnd = drawLanguagesCol(ctx, langsX, langsW, startY);
  ctx.y = Math.max(skillsEnd, langsEnd);
}

// ── Lower section measurement + grouping ──────────────────────────────────────
export function cbMeasureLowerSectionsHeight(ctx: ContemporaryBoldPdfContext): number {
  const hasSkills = ctx.cv.skills.length > 0;
  const hasLangs = ctx.cv.languages.length > 0;
  const skillsW = hasLangs ? ctx.contentW * SKILLS_COL_RATIO : ctx.contentW;
  const eduH = measureEducationH(ctx);
  const slH = hasSkills || hasLangs ? Math.max(
    hasSkills ? measureSkillsH(ctx, skillsW) : 0,
    hasLangs ? measureLangsH(ctx) : 0,
  ) : 0;
  return eduH + slH;
}

/**
 * Draw Education + Skills + Languages as a grouped lower block.
 * If the whole group fits on a fresh page, move there — avoids stranding
 * lower sections alone on a mostly-empty final page.
 */
export function cbDrawLowerSections(ctx: ContemporaryBoldPdfContext): void {
  const totalH = cbMeasureLowerSectionsHeight(ctx);
  if (totalH > 0 && totalH <= freshCap(ctx) && ctx.y + totalH > ctx.bottomSafeY) {
    cbAddPage(ctx);
  }
  if (ctx.cv.education.length) cbDrawEducationSection(ctx);
  if (ctx.cv.skills.length || ctx.cv.languages.length) cbDrawSkillsLanguagesGroup(ctx);
}

// ── Blob builder ──────────────────────────────────────────────────────────────
export async function buildContemporaryBoldPagedPdfBlob(
  cv: CVData,
  locale: Locale,
  options: { photoDataUrl?: string | null } = {},
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const i18n = await registerPdfI18nFonts(pdf);
  const ctx = cbCreateContext(pdf, cv, locale, i18n);

  const maskedPhoto = options.photoDataUrl
    ? await preparePdfCircularPhotoDataUrl(options.photoDataUrl)
    : null;
  cbDrawHeader(ctx, maskedPhoto);
  cbDrawSummary(ctx);
  cbDrawExperienceSection(ctx);
  cbDrawLowerSections(ctx);

  const output = pdf.output('blob');
  return output instanceof Blob ? output : new Blob([output], { type: 'application/pdf' });
}
