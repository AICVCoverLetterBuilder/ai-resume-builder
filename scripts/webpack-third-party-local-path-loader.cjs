'use strict';

/**
 * Canonicalize two exact third-party build-machine path producers in browser
 * bundles. Both transforms are fail-closed and apply only to their resolved
 * package files via next.config.ts; dependency files themselves stay intact.
 */
module.exports = function thirdPartyLocalPathLoader(source) {
  this.cacheable?.();

  if (source.includes('var _scriptDir = import.meta.url;')) {
    const expected = 'var _scriptDir = import.meta.url;';
    const occurrences = source.split(expected).length - 1;
    if (occurrences !== 1) {
      throw new Error(
        `[third-party-local-path-loader] expected one Yoga import.meta.url override; found ${occurrences}`,
      );
    }
    // Yoga's existing document.currentScript fallback remains in effect and
    // its WASM payload is already inline; only a local source URI override is
    // removed.
    return source.replace(expected, 'var _scriptDir = "";');
  }

  const pdfKitDirectory = /var __dirname = '(?:\/(?:home|Users)\/[^']+)';/g;
  const matches = source.match(pdfKitDirectory) || [];
  if (matches.length === 1) {
    // PDFKit's browser artifact contains an upstream build-directory literal
    // only for its optional PDF/A color-profile lookup. Use a relative
    // directory token instead of copying an upstream build-machine location.
    return source.replace(pdfKitDirectory, "var __dirname = '.';");
  }

  throw new Error(
    `[third-party-local-path-loader] unrecognized scoped source; expected Yoga or PDFKit local-path producer`,
  );
};
