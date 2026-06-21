/**
 * native-print.ts — Android native print bridge for PDF export
 *
 * On Android (Capacitor): uses PrintPdfPlugin to invoke the system
 * PrintManager / PrintDocumentAdapter flow — opens the real Android
 * print dialog (Save as PDF / Print), not Chrome.
 *
 * On web: exportToPDF already uses jsPDF + html2canvas for PDF generation,
 * then fall back to browser print via openPrintFallback. The native-print
 * module is a no-op on web.
 *
 * This module's printNativePdf function:
 * - Serializes the CV preview DOM element into self-contained HTML
 * - Calls the PrintPdfPlugin.print() native bridge
 * - Returns 'saved', 'cancelled', or 'failed'
 * - NEVER opens Chrome, never uses window.open, never navigates
 */

import { Capacitor } from '@capacitor/core';
import { registerPlugin } from '@capacitor/core';

// ─── Plugin interface ─────────────────────────────────────────────────────────

interface PrintPdfPluginDefinition {
  print(options: {
    html: string;
    jobName: string;
  }): Promise<{ result: 'saved' | 'cancelled' | 'failed'; message: string }>;
}

const PrintPdfNative = registerPlugin<PrintPdfPluginDefinition>('PrintPdf');

// ─── Custom error ─────────────────────────────────────────────────────────────

/**
 * Thrown when the user cancels the print dialog.
 * Do not increment counters for this error.
 */
export class PrintCancelledError extends Error {
  constructor() {
    super('Print cancelled by user');
    this.name = 'PrintCancelledError';
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Serialize a DOM element into a self-contained HTML document with all
 * styles and fonts baked in, suitable for printing / PDF generation.
 */
function serializeElementForPrint(
  element: HTMLElement,
  fileName: string,
): string {
  // On native Android the HTML is loaded into an offscreen WebView with
  // file:///android_asset/public/ as base URL, so font paths must be relative.
  // On web the absolute URL from window.location.origin resolves correctly.
  const fontBase = isNativeAndroid()
    ? 'fonts'   // resolves against file:///android_asset/public/ base
    : `${window.location.origin}/fonts`;

  const notoFontCSS = `
@font-face { font-family: 'NotoSans'; font-weight: 400; src: url('${fontBase}/NotoSans-Regular.ttf') format('truetype'); }
@font-face { font-family: 'NotoSans'; font-weight: 700; src: url('${fontBase}/NotoSans-Bold.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansArabic'; font-weight: 400; src: url('${fontBase}/NotoSansArabic-Regular.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansArabic'; font-weight: 700; src: url('${fontBase}/NotoSansArabic-Bold.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansDevanagari'; font-weight: 400; src: url('${fontBase}/NotoSansDevanagari-Regular.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansDevanagari'; font-weight: 700; src: url('${fontBase}/NotoSansDevanagari-Bold.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansJP'; font-weight: 400; src: url('${fontBase}/NotoSansJP-Regular.ttf') format('truetype'); }
@font-face { font-family: 'NotoSansJP'; font-weight: 700; src: url('${fontBase}/NotoSansJP-Bold.ttf') format('truetype'); }
`;

  // Collect all <style> and <link rel="stylesheet"> tags
  const pageStyles = Array.from(
    document.querySelectorAll('style, link[rel="stylesheet"]'),
  )
    .map(node => node.outerHTML)
    .join('\n');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${fileName}</title>
  ${pageStyles}
  <style>
    ${notoFontCSS}
    @page { margin: 0; size: A4; }
    body { margin: 0; padding: 0; background: #fff; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>${element.innerHTML}</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface PrintResult {
  result: 'saved' | 'cancelled' | 'failed';
  message: string;
}

/**
 * Invoke the Android system print dialog for the given DOM element's content.
 * On Android native, this uses PrintPdfPlugin → PrintManager to show the
 * real Android print / Save as PDF dialog.
 *
 * On web, this returns null — callers should fall back to their usual
 * web-based export (jsPDF + html2canvas or openPrintFallback).
 *
 * @param element - The DOM element whose content to print
 * @param fileName - The print job / filename (e.g. "cv-modern-minimal")
 * @returns PrintResult on Android, or null on web
 * @throws PrintCancelledError when user cancels print dialog
 */
export async function printNativePdf(
  element: HTMLElement,
  fileName: string,
): Promise<PrintResult | null> {
  if (!isNativeAndroid()) {
    return null; // Not native Android — caller falls back to web flow
  }

  // Flush two animation frames so any pending React state updates have painted
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  const html = serializeElementForPrint(element, fileName);

  try {
    const result = await PrintPdfNative.print({
      html,
      jobName: fileName,
    });

    if (result.result === 'cancelled') {
      throw new PrintCancelledError();
    }

    if (result.result === 'failed') {
      console.error('[native-print] Print failed:', result.message);
    }

    return result;
  } catch (err: unknown) {
    if (err instanceof PrintCancelledError) throw err;
    const msg = err instanceof Error ? err.message : 'Unknown print plugin error';
    console.error('[native-print] Plugin error:', msg);
    return { result: 'failed', message: msg };
  }
}
