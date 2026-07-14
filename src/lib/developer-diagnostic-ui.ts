/**
 * Centralized guard for developer-only diagnostic UI.
 * Visible in local development / non-production; hidden in production web and
 * Capacitor Android release builds (Next export with NODE_ENV=production).
 * Does not gate diagnostic collection, logging, or user-facing error toasts.
 */
export function isDeveloperDiagnosticUiEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}
