#!/usr/bin/env node
/**
 * Production static export for Capacitor Android/iOS.
 * Must set NEXT_PUBLIC_STATIC_EXPORT so next.config.ts writes to webDir (out/).
 */
const { execSync } = require('node:child_process');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

const env = {
  ...process.env,
  NEXT_PUBLIC_STATIC_EXPORT: 'true',
};

const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const command = isWindows
  ? `"${process.execPath}" "${nextBin}" build`
  : `"${process.execPath}" "${nextBin}" build`;

console.log('[build:static] NEXT_PUBLIC_STATIC_EXPORT=true');
execSync(command, { cwd: repoRoot, stdio: 'inherit', env, shell: isWindows });
