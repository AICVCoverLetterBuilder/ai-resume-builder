import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import React from "react";
import "./globals.css";
import { Providers } from "./providers";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, languages } from "@/lib/i18n/translations";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CV Pro AI — Professional Resumes. AI-Powered.",
    template: "%s | CV Pro AI",
  },
  description:
    "Professional resumes. AI-powered. AI & Smart Resume Builder. 8 premium templates, multilingual support, and Job Description Analyzer. One-time payment of $3.99 – lifetime access.",
  metadataBase: new URL("https://cvproai.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "CV Pro AI — Professional Resumes. AI-Powered.",
    description:
      "Professional resumes. AI-powered. Lifetime access for $3.99. No subscription.",
    url: "https://cvproai.com",
    siteName: "CV Pro AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CV Pro AI — Professional Resumes. AI-Powered.",
    description:
      "Professional resumes. AI-powered. Lifetime access for $3.99. No subscription.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/ios/icon-120x120.png", sizes: "120x120", type: "image/png" },
      { url: "/ios/icon-152x152.png", sizes: "152x152", type: "image/png" },
      { url: "/ios/icon-167x167.png", sizes: "167x167", type: "image/png" },
      { url: "/ios/icon-180x180.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "apple-touch-icon-precomposed",
        url: "/ios/icon-180x180.png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1a56db" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1628" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const localeCodes = JSON.stringify(languages.map((language) => language.code));
  const localeDirections = JSON.stringify(Object.fromEntries(languages.map((language) => [language.code, language.dir])));
  const localeBootstrapScript = `
    (function() {
      var supported = ${localeCodes};
      var directionMap = ${localeDirections};
      var stored = null;
      try { stored = localStorage.getItem('${LOCALE_STORAGE_KEY}'); } catch (error) {}

      function resolve(candidate) {
        if (!candidate || typeof candidate !== 'string') return null;
        var normalized = candidate.trim();
        if (!normalized) return null;
        var exact = supported.find(function(code) { return code.toLowerCase() === normalized.toLowerCase(); });
        if (exact) return exact;
        var base = normalized.split(/[-_]/)[0].toLowerCase();
        if (base === 'pt') return 'pt-BR';
        return supported.find(function(code) { return code.toLowerCase() === base; }) || null;
      }

      var locale = resolve(stored) || '${DEFAULT_LOCALE}';
      document.documentElement.lang = locale;
      document.documentElement.dir = directionMap[locale] || 'ltr';
      window.__cvproLocale = locale;
    })();
  `;

  return (
    <html lang="und" suppressHydrationWarning>
      <head>
        {/* Noto Sans JP loaded via <link> to avoid Turbopack @font-face resolution bug */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: localeBootstrapScript }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} style={{ '--font-noto-jp': "'Noto Sans JP'" } as React.CSSProperties}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
