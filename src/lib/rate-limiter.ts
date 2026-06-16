/**
 * rate-limiter.ts — Simple in-memory rate limiter for server-side API routes.
 *
 * Uses an in-memory Map with IP-based tracking.
 * Note: In-memory rate limiting resets on server restart.
 * For production with multiple instances, use Redis or a similar distributed store.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired entries (every 5 minutes)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
};

const AI_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 AI requests per minute per IP
};

/**
 * Returns true if the request is allowed, false if rate limited.
 * Throws for invalid input.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): boolean {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Rate limit identifier must be a non-empty string');
  }

  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now >= entry.resetAt) {
    // First request or window expired — start fresh
    store.set(identifier, { count: 1, resetAt: now + config.windowMs });
    return true;
  }

  if (entry.count >= config.maxRequests) {
    return false; // Rate limited
  }

  entry.count++;
  return true;
}

/**
 * Extract a reasonable rate-limit key from a NextRequest.
 * Uses IP (x-forwarded-for or x-real-ip), falling back to a shared key.
 */
export function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim();
    if (ip) return `ip:${ip}`;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return `ip:${realIp}`;
  // Fallback — all requests without a detectable IP share this key.
  // This is still better than no limit at all.
  return 'unknown-ip';
}

export { AI_CONFIG };
