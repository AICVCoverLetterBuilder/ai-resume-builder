import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

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

// Internal-test Pro is a separate, explicit client request capability. It is
// compiled on only for an internal build when the flag is explicitly true;
// the server-only authority is never exposed through Next's public env map.
const internalTestProEntitlementEnabled =
  sourceChannel === 'internal' && process.env.NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT === 'true';
const internalTestProBootstrapCapability =
  sourceChannel === 'internal' ? (process.env.NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY || '') : '';

const compiled = internalAiResetEnabled ? 'true' : 'false';
process.env.NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED = compiled;
process.env.NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT = internalTestProEntitlementEnabled ? 'true' : 'false';
process.env.NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY = internalTestProBootstrapCapability;

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
  // Production builds type-check application/runtime sources. Test fixtures
  // retain their independent Vitest contract and are intentionally excluded
  // through tsconfig.build.json rather than suppressing application errors.
  typescript: {
    tsconfigPath: 'tsconfig.build.json',
  },
  env: {
    NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED: compiled,
    NEXT_PUBLIC_INTERNAL_TEST_PRO_ENTITLEMENT: internalTestProEntitlementEnabled ? 'true' : 'false',
    NEXT_PUBLIC_INTERNAL_TEST_PRO_BOOTSTRAP_CAPABILITY: internalTestProBootstrapCapability,
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
  webpack: (config, { isServer }) => {
    // These two browser artifacts retain upstream build-machine references:
    // Yoga's import.meta.url override and PDFKit's PDF/A profile directory.
    // The scoped loader canonicalizes only those values, preserving Yoga's
    // document.currentScript fallback and avoiding source-host metadata in
    // emitted browser assets.
    if (!isServer) {
      config.module.rules.push({
        test: /[\\/]node_modules[\\/](?:yoga-layout[\\/]dist[\\/]binaries[\\/]yoga-wasm-base64-esm|@react-pdf[\\/]pdfkit[\\/]lib[\\/]pdfkit\.browser)\.js$/,
        use: [
          {
            loader: resolve(
              process.cwd(),
              'scripts/webpack-third-party-local-path-loader.cjs',
            ),
          },
        ],
      });
    }
    return config;
  },
} satisfies NextConfig;

export default nextConfig;
