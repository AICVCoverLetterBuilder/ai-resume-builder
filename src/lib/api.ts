/**
 * Centralized API client for the CV Pro AI backend.
 *
 * Web/Vercel mode: uses relative URLs (e.g. /api/generate).
 * Capacitor native mode: uses NEXT_PUBLIC_API_BASE_URL baked in at build time.
 *
 * IMPORTANT (Android build 230 regression): a stale `cvpro_api_base_url` value in
 * localStorage previously took precedence over the Production URL baked into the
 * AAB. That made fetch() fail immediately (DNS/TLS against a dead Preview host)
 * and the catch-path classified the TypeError as `network_error`. Release builds
 * must prefer the build-time Production URL; localStorage is only a last-resort
 * override when no build-time URL exists, and only when it is valid HTTPS.
 */

const API_BASE_STORAGE_KEY = 'cvpro_api_base_url';

/** True when `value` is an absolute https:// URL with a non-empty hostname. */
export function isValidHttpsApiBaseUrl(value: string | null | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return false;
    if (!url.hostname || url.hostname === 'localhost' || url.hostname === '127.0.0.1') return false;
    // Preview deployments and local tunnels are never acceptable as the baked
    // Production endpoint for a release Android build.
    if (url.hostname.endsWith('.vercel.app') && url.hostname.includes('-git-')) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function readStoredApiBaseUrl(): string | null {
  try {
    const stored = localStorage.getItem(API_BASE_STORAGE_KEY);
    if (!stored) return null;
    const normalized = normalizeBaseUrl(stored.trim());
    return isValidHttpsApiBaseUrl(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

function readBuildTimeApiBaseUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!raw || typeof raw !== 'string') return null;
  const normalized = normalizeBaseUrl(raw.trim());
  return isValidHttpsApiBaseUrl(normalized) ? normalized : null;
}

/** Resolved API origin for Capacitor/native (empty string = same-origin / relative). */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. Build-time Production URL wins for release Android/web builds.
  const buildTime = readBuildTimeApiBaseUrl();
  if (buildTime) return buildTime;

  // 2. Valid HTTPS localStorage override only when no build-time URL was baked in
  //    (e.g. local Capacitor debug against a custom backend).
  const stored = readStoredApiBaseUrl();
  if (stored) return stored;

  // 3. Same-origin / relative (web on Vercel).
  return '';
}

export function resolveApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${cleanPath}` : cleanPath;
}

interface ApiFetchOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

interface ApiFetchResult<T = unknown> {
  data: T;
  response: Response;
  /** True when the HTTP body could not be parsed as JSON. */
  jsonParseFailed?: boolean;
}

/**
 * Centralized fetch wrapper for API calls.
 * Automatically resolves the base URL and serializes JSON bodies.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<ApiFetchResult<T>> {
  const url = resolveApiUrl(path);
  const { body, signal, headers: extraHeaders } = options;
  const method = options.method || (body ? 'POST' : 'GET');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  let data: T;
  let jsonParseFailed = false;
  try {
    data = (await res.json()) as T;
  } catch {
    jsonParseFailed = true;
    // Synthetic body so callers never need to dereference null and so HTTP
    // failures are not misclassified as transport-level network errors.
    data = {
      error: 'Invalid JSON response from AI server.',
      code: 'provider_temporarily_unavailable',
    } as unknown as T;
  }

  return { data, response: res, jsonParseFailed };
}
