/**
 * Rate Limiting Foundation for Next.js BFF.
 * 
 * ARCHITECTURAL CONSTRAINTS:
 * - Architecture must support Redis-backed distributed rate limiting later (per ADR-0001).
 * - DevMemoryRateLimiter is strictly an in-memory development and testing adapter.
 *   It is NOT production-safe and must NOT be represented as horizontally scalable.
 * - Client IP extraction defaults to trustProxy = false to prevent spoofed X-Forwarded-For attacks.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp in seconds
  retryAfter: number; // Seconds to wait before next request
}

export interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

interface MemoryBucket {
  count: number;
  resetAt: number; // Milliseconds timestamp
}

/**
 * In-memory sliding-window limiter for development and automated testing only.
 * 
 * WARNING:
 * - Not safe for multi-process, horizontally scaled, or serverless deployments.
 * - State will be lost on process restart.
 * - Redis-backed distributed rate limiting is required for production.
 */
export class DevMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, MemoryBucket>();
  private lastPruneTime = Date.now();

  constructor() {
    // Label clearly for observability
  }

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    // Prune stale entries every 60 seconds to prevent unbounded memory growth
    if (now - this.lastPruneTime > 60_000) {
      this.pruneStaleBuckets(now);
    }

    let bucket = this.buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.buckets.set(key, bucket);

      return {
        success: true,
        limit,
        remaining: limit - 1,
        resetAt: Math.ceil(bucket.resetAt / 1000),
        retryAfter: 0,
      };
    }

    bucket.count += 1;
    const isAllowed = bucket.count <= limit;
    const remaining = Math.max(0, limit - bucket.count);
    const retryAfter = isAllowed ? 0 : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    return {
      success: isAllowed,
      limit,
      remaining,
      resetAt: Math.ceil(bucket.resetAt / 1000),
      retryAfter,
    };
  }

  private pruneStaleBuckets(now: number): void {
    this.lastPruneTime = now;
    for (const [key, bucket] of this.buckets.entries()) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Reset all memory buckets (useful for test isolation).
   */
  clear(): void {
    this.buckets.clear();
    this.lastPruneTime = Date.now();
  }
}

export interface ClientIdentifierOptions {
  trustProxy?: boolean;
}

/**
 * Safely extracts client identifier for rate limiting.
 * 
 * SECURITY RULE:
 * - When trustProxy is false (default), X-Forwarded-For must NOT be trusted because
 *   arbitrary clients can spoof it to bypass IP rate limits.
 * - When trustProxy is true, the nearest (rightmost) proxy hop should be used.
 */
export function getClientIdentifier(request: Request, options: ClientIdentifierOptions = {}): string {
  const trustProxy = options.trustProxy ?? (process.env.TRUST_PROXY === 'true');

  if (trustProxy) {
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      // Use the client IP from proxy chain (the leftmost trusted or rightmost depending on hops)
      const ips = xForwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean);
      if (ips.length > 0) {
        return ips[0];
      }
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp && realIp.trim()) {
      return realIp.trim();
    }
  }

  // Fallback when not trusting arbitrary proxy headers:
  // Use CF-Connecting-IP if deployed behind Cloudflare, or combine safe edge signals
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp && trustProxy) {
    return cfConnectingIp.trim();
  }

  // Safe fallback identifier for local/untrusted environment
  return 'untrusted-client-boundary';
}

// Global development rate limiter instance
const defaultDevRateLimiter = new DevMemoryRateLimiter();

/**
 * Resolves the rate limiter implementation.
 * 
 * Note: Distributed RedisRateLimiter is pending Gate 0C/infrastructure setup.
 * For Phase 0 Gate 0B, DevMemoryRateLimiter provides local development and unit test validation.
 */
export function getRateLimiter(): RateLimiter {
  return defaultDevRateLimiter;
}
