import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('AAB-392 internal diagnostics packaging guard', () => {
  it('makes the internal Android command verify copied, not merely source, assets', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const script = fs.readFileSync(path.join(root, 'scripts', 'build-android-internal.js'), 'utf8');
    expect(pkg.scripts['build:android:internal']).toBe('node scripts/build-android-internal.js');
    const nextBuildIndex = script.indexOf("[nextBin, 'build']");
    const staticBuildIndex = script.indexOf('[staticBuildScript]');
    const capSyncIndex = script.indexOf("['cap', 'sync', 'android']");

    expect(nextBuildIndex).toBeGreaterThanOrEqual(0);
    expect(staticBuildIndex).toBeGreaterThan(nextBuildIndex);
    expect(capSyncIndex).toBeGreaterThan(staticBuildIndex);
    expect(script).toContain("'android', 'app', 'src', 'main', 'assets', 'public'");
    expect(script).toContain('verify-internal-ai-reset-assets.mjs');
    expect(script).toContain("requiredEnv('NEXT_PUBLIC_API_BASE_URL')");
    expect(script).toContain("requiredEnv('NEXT_PUBLIC_REVENUECAT_ANDROID_API_KEY')");
    expect(script).toContain('RevenueCat Android public key is absent from copied Android assets');
    expect(script).toContain('aab392-internal-diagnostics-packaging-v1');
    expect(script).toContain('server?.url');
  });
});
