import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { PDF_I18N_MIN_FONT_BYTES, REQUIRED_PDF_FONT_FILES } from '@/lib/pdf-i18n-text';

describe('Android release PDF font assets', () => {
  test('public/fonts contains all required multilingual PDF fonts', () => {
    const fontsDir = path.join(process.cwd(), 'public', 'fonts');
    for (const fileName of REQUIRED_PDF_FONT_FILES) {
      const full = path.join(fontsDir, fileName);
      expect(fs.existsSync(full), `missing ${fileName}`).toBe(true);
      expect(fs.statSync(full).size).toBeGreaterThanOrEqual(PDF_I18N_MIN_FONT_BYTES);
    }
  });

  test('verify-android-release-assets passes on synced assets when present', () => {
    const outFonts = path.join(process.cwd(), 'out', 'fonts');
    const androidFonts = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', 'public', 'fonts');
    if (!fs.existsSync(outFonts) || !fs.existsSync(androidFonts)) {
      return;
    }
    const output = execSync('node scripts/verify-android-release-assets.js', {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(output).toContain('PDF fonts OK');
  });
});
