import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('AAB-392 internal diagnostics packaging guard', () => {
  it('makes the internal Android command verify copied, not merely source, assets', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const script = fs.readFileSync(path.join(root, 'scripts', 'build-android-internal.js'), 'utf8');
    expect(pkg.scripts['build:android:internal']).toBe('node scripts/build-android-internal.js');
    expect(script.indexOf('next build')).toBeLessThan(script.indexOf('build-static-internal.js'));
    expect(script.indexOf('build-static-internal.js')).toBeLessThan(script.indexOf('cap sync android'));
    expect(script).toContain("'android', 'app', 'src', 'main', 'assets', 'public'");
    expect(script).toContain('verify-internal-ai-reset-assets.mjs');
    expect(script).toContain('ai-resume-builder-six-gamma.vercel.app');
    expect(script).toContain('aab392-internal-diagnostics-packaging-v1');
    expect(script).toContain('server?.url');
  });
});
