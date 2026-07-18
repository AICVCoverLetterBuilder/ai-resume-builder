#!/usr/bin/env node
/**
 * Build Next in enabled + disabled internal-AI-reset modes and verify `out/`.
 * Does not build an AAB. Does not modify versionCode.
 *
 * Usage: node scripts/verify-internal-ai-reset-builds.mjs
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const verify = path.join(__dirname, 'verify-internal-ai-reset-assets.mjs');

function run(cmd, env) {
  console.log(`[verify-builds] ${cmd}`);
  execSync(cmd, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: true,
  });
}

// Disabled / production-like (source flags absent)
run('npm.cmd run build:static', {
  NEXT_PUBLIC_BUILD_CHANNEL: '',
  NEXT_PUBLIC_ENABLE_AI_TEST_RESET: '',
});
run(`node "${verify}" --dir out --expect disabled`);

// Enabled internal
run('npm.cmd run build:static', {
  NEXT_PUBLIC_BUILD_CHANNEL: 'internal',
  NEXT_PUBLIC_ENABLE_AI_TEST_RESET: 'true',
});
run(`node "${verify}" --dir out --expect enabled`);

console.log('[verify-builds] OK both modes');
