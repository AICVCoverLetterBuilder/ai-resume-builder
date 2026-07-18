import type { NextConfig } from "next";

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

if (internalAiResetEnabled) {
  console.log('[build-channel] Internal AI test reset ENABLED');
} else {
  console.log('[build-channel] Internal AI test reset disabled');
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_INTERNAL_AI_RESET_ENABLED: compiled,
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
