import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../../..');

function readConfig(relPath: string): Record<string, unknown> {
  const full = path.join(repoRoot, relPath);
  expect(fs.existsSync(full), `${relPath} must exist`).toBe(true);
  return JSON.parse(fs.readFileSync(full, 'utf8')) as Record<string, unknown>;
}

describe('Android release Capacitor config', () => {
  it('does not point production builds at a dev server', () => {
    const relPath = 'capacitor.config.json';
    const config = readConfig(relPath);
    const server = config.server as { url?: string; androidScheme?: string } | undefined;

    expect(config.appId).toBe('com.cvproai.app');
    expect(config.appName).toBe('CV Pro AI');
    expect(server?.url, `${relPath} must not set server.url`).toBeUndefined();
    expect(server?.androidScheme).toBe('https');
  });

  it('uses bundled out/ as webDir', () => {
    const config = readConfig('capacitor.config.json');
    expect(config.webDir).toBe('out');
  });
});
