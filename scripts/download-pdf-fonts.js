#!/usr/bin/env node
/**
 * Download bundled multilingual PDF fonts into public/fonts/.
 * Run after clone or when fonts are missing: node scripts/download-pdf-fonts.js
 */
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');

const { REQUIRED_PDF_FONT_FILES, MIN_FONT_BYTES } = require('./pdf-font-manifest');

const repoRoot = path.resolve(__dirname, '..');
const fontsDir = path.join(repoRoot, 'public', 'fonts');

const DOWNLOAD_URLS = {
  'NotoSans-Regular.ttf': 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf',
  'NotoSans-Bold.ttf': 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf',
  'NotoSansArabic-Regular.ttf': 'https://raw.githubusercontent.com/notofonts/arabic/main/fonts/NotoSansArabic/hinted/ttf/NotoSansArabic-Regular.ttf',
  'NotoSansArabic-Bold.ttf': 'https://raw.githubusercontent.com/notofonts/arabic/main/fonts/NotoSansArabic/hinted/ttf/NotoSansArabic-Bold.ttf',
  'NotoSansDevanagari-Regular.ttf': 'https://raw.githubusercontent.com/notofonts/devanagari/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Regular.ttf',
  'NotoSansDevanagari-Bold.ttf': 'https://raw.githubusercontent.com/notofonts/devanagari/main/fonts/NotoSansDevanagari/hinted/ttf/NotoSansDevanagari-Bold.ttf',
  'NotoSansJP-Regular.ttf': 'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansJP-Regular.otf',
  'NotoSansJP-Bold.ttf': 'https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansJP-Bold.otf',
};

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(fontsDir, { recursive: true });
  let failed = false;

  for (const fileName of REQUIRED_PDF_FONT_FILES) {
    const dest = path.join(fontsDir, fileName);
    if (fs.existsSync(dest) && fs.statSync(dest).size >= MIN_FONT_BYTES) {
      console.log(`[download-pdf-fonts] skip (exists) ${fileName}`);
      continue;
    }
    const url = DOWNLOAD_URLS[fileName];
    if (!url) {
      console.error(`[download-pdf-fonts] no URL for ${fileName}`);
      failed = true;
      continue;
    }
    try {
      console.log(`[download-pdf-fonts] downloading ${fileName}...`);
      const buf = await download(url);
      if (buf.byteLength < MIN_FONT_BYTES) {
        throw new Error(`file too small (${buf.byteLength} bytes)`);
      }
      fs.writeFileSync(dest, buf);
      console.log(`[download-pdf-fonts] OK ${fileName} (${buf.byteLength} bytes)`);
    } catch (err) {
      console.error(`[download-pdf-fonts] FAIL ${fileName}: ${err.message}`);
      failed = true;
    }
  }

  if (failed) process.exit(1);
  console.log('[download-pdf-fonts] all required PDF fonts present');
}

main();
