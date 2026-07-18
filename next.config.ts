import type { NextConfig } from "next";
import { logBuildChannelAiResetStatus } from "./src/lib/build-channel";

// Exact build-time gate status (no usage history / PII).
logBuildChannelAiResetStatus();

const nextConfig: NextConfig = {
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