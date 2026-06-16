/**
 * Centralized API client for the CV Pro AI backend.
 *
 * Web/Vercel mode: uses relative URLs (e.g. /api/generate).
 * Capacitor native mode: uses a configurable base URL from localStorage
 * or the NEXT_PUBLIC_API_BASE_URL build-time env var.
 *
 * The Capacitor app should set the base URL at startup:
 *   localStorage.setItem('cvpro_api_base_url', 'https://api.cvproai.com')
 */

function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // 1. localStorage override (set by Capacitor native at startup)
  try {
    const stored = localStorage.getItem('cvpro_api_base_url');
    if (stored) return stored.replace(/\/+$/, '');
  } catch {
    // localStorage unavailable
  }

  // 2. Build-time env var (NEXT_PUBLIC_*)
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '');
  }

  // 3. Default: relative URL (works in web/Vercel dev and production)
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
  try {
    data = (await res.json()) as T;
  } catch {
    data = null as unknown as T;
  }

  return { data, response: res };
}