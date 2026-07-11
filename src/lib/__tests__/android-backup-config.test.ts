import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'android/app/src/main/AndroidManifest.xml');
const DATA_RULES_PATH = path.join(REPO_ROOT, 'android/app/src/main/res/xml/data_extraction_rules.xml');

describe('Android backup config for sensitive CV data', () => {
  test('AndroidManifest disables allowBackup for production', () => {
    const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
    expect(manifest).toMatch(/android:allowBackup\s*=\s*"false"/);
    expect(manifest).not.toMatch(/android:allowBackup\s*=\s*"true"/);
  });

  test('AndroidManifest references data extraction rules', () => {
    const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
    expect(manifest).toContain('android:dataExtractionRules="@xml/data_extraction_rules"');
  });

  test('data extraction rules exclude all domains from cloud backup and device transfer', () => {
    const rules = fs.readFileSync(DATA_RULES_PATH, 'utf8');
    expect(rules).toContain('<cloud-backup>');
    expect(rules).toContain('<device-transfer>');
    for (const domain of ['root', 'file', 'database', 'sharedpref', 'external']) {
      expect(rules).toContain(`domain="${domain}"`);
    }
  });

  test('verify-android-release-assets script enforces disabled backup', () => {
    const script = fs.readFileSync(path.join(REPO_ROOT, 'scripts/verify-android-release-assets.js'), 'utf8');
    expect(script).toContain('assertSensitiveDataBackupDisabled');
    expect(script).toContain('android:allowBackup="false"');
  });
});

describe('production source sample-data regression', () => {
  const forbidden = ['Dragan Obradovic', 'diodala12@gmail.com', 'Učitelj u osnovnoj', 'Braće Abafi', 'Metematički fakultet'];
  const scanRoots = [
    path.join(REPO_ROOT, 'src/app'),
    path.join(REPO_ROOT, 'src/lib'),
    path.join(REPO_ROOT, 'src/components'),
  ];

  function walk(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__tests__') continue;
        walk(full, out);
      } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  }

  test('forbidden sample CV identities do not appear in production source outside tests', () => {
    const files = scanRoots.flatMap((root) => walk(root));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const token of forbidden) {
        expect(text, `${token} found in ${path.relative(REPO_ROOT, file)}`).not.toContain(token);
      }
    }
  });
});
