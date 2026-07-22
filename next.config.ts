import type { NextConfig } from "next";
import { execSync } from "node:child_process";

/**
 * Compile the internal AI reset gate into a single NEXT_PUBLIC_* value that
 * Next can statically inline into the client bundle.
 *
 * Both source flags must be exact; otherwise the compiled value is "false".
 * Android WebView has no Node `process.env` — only inlined literals work.
 */
const sourceChannel = process.env.NEXT_PUBLIC_BUILD_CHANNEL;
const sourceEnable = process.env.NEXT_PUBLIC_ENABLE_AI_TEST_RESET;
const internalAiResetEnabled =
  sourceChannel === 'internal' && sourceEnable === 'true';

const compiled = internalAiResetEnabled ? 'true' : 'false';
process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED = compiled;

function resolveSourceCommitShortForBuild(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SOURCE_COMMIT_SHORT
    || process.env.VERCEL_GIT_COMMIT_SHA
    || process.env.GITHUB_SHA
    || '').trim();
  if (/^[0-9a-f]{7,40}$/i.test(fromEnv)) {
    return fromEnv.slice(0, 7).toLowerCase();
  }
  try {
    const short = execSync('git rev-parse --short=7 HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^[0-9a-f]{7}$/i.test(short)) return short.toLowerCase();
  } catch {
    /* unavailable in some CI sandboxes */
  }
  return '';
}

const sourceCommitShort = resolveSourceCommitShortForBuild();
if (sourceCommitShort) {
  process.env.NEXT_PUBLIC_SOURCE_COMMIT_SHORT = sourceCommitShort;
}

if (internalAiResetEnabled) {
  console.log('[build-channel] Internal AI test reset ENABLED');
} else {
  console.log('[build-channel] Internal AI test reset disabled');
}
if (sourceCommitShort) {
  console.log(`[build-channel] sourceCommitShort=${sourceCommitShort}`);
} else {
  console.log('[build-channel] sourceCommitShort unavailable_by_contract');
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED: compiled,
    NEXT_PUBLIC_SOURCE_COMMIT_SHORT: sourceCommitShort,
  },
  ...(process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true'
    ? { output: 'export' as const }
    : {}),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.revenuecat.com',
      },
    ],
  },
} satisfies NextConfig;

export default nextConfig;
