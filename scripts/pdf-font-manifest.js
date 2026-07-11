/**
 * Shared manifest for bundled multilingual PDF fonts (public/fonts).
 * Used by Android release verification and font download scripts.
 */
const REQUIRED_PDF_FONT_FILES = [
  'NotoSans-Regular.ttf',
  'NotoSans-Bold.ttf',
  'NotoSansArabic-Regular.ttf',
  'NotoSansArabic-Bold.ttf',
  'NotoSansDevanagari-Regular.ttf',
  'NotoSansDevanagari-Bold.ttf',
  'NotoSansJP-Regular.ttf',
  'NotoSansJP-Bold.ttf',
];

const MIN_FONT_BYTES = 1024;

module.exports = {
  REQUIRED_PDF_FONT_FILES,
  MIN_FONT_BYTES,
};
