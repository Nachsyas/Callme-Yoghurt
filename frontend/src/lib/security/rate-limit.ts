/**
 * Rate Limiting Foundation for Next.js BFF (Gate 0B.1 Hardening).
 * 
 * ARCHITECTURAL CONSTRAINTS:
 * - Architecture must support Redis-backed distributed rate limiting later (per ADR-0001).
 * - DevMemoryRateLimiter is strictly an in-memory development and testing adapter.
 *   It is NOT production-safe and must NEVER be used silently in production.
 * - Production without a configured distributed limiter fails closed via UnavailableProductionRateLimiter.
 * - Client IP extraction defaults to trustProxy = false to prevent spoofed X-Forwarded-For attacks.
 * - In development, safe client signals (such as X-Dev-Client-Id or user-agent) isolate test identities,
 *   preventing a single global shared bucket from colliding across unrelated tests or users.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp in seconds
  retryAfter: number; // Seconds to wait before next request
}

export type RateLimiterType = 'development-memory' | 'production-distributed' | 'unavailable';

export interface RateLimiter {
  readonly type: RateLimiterType;
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
 * - Must never be used in production.
 */
export class DevMemoryRateLimiter implements RateLimiter {
  readonly type = 'development-memory' as const;
  private readonly buckets = new Map<string, MemoryBucket>();
  private lastPruneTime = Date.now();

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
    this.buckets.forEach((bucket, key) => {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    });
  }

  /**
   * Reset all memory buckets (useful for test isolation).
   */
  clear(): void {
    this.buckets.clear();
    this.lastPruneTime = Date.now();
  }
}

/**
 * Unavailable production limiter that fails closed safely and visibly.
 * 
 * Used when production is booted without configured distributed rate-limiting infrastructure (Redis).
 */
export class UnavailableProductionRateLimiter implements RateLimiter {
  readonly type = 'unavailable' as const;

  async check(_key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    console.error(
      'SECURITY CRITICAL: Rate limiting is unavailable in production because distributed storage (Redis) is not configured. Failing closed.',
    );

    const now = Math.ceil(Date.now() / 1000);
    return {
      success: false,
      limit,
      remaining: 0,
      resetAt: now + windowSeconds,
      retryAfter: windowSeconds,
    };
  }
}

export interface ClientIdentifierOptions {
  trustProxy?: boolean;
  environment?: string;
}

/**
 * Safely extracts client identifier for rate limiting.
 * 
 * SECURITY RULE:
 * - When trustProxy is false (default), X-Forwarded-For must NOT be trusted because
 *   arbitrary clients can spoof it to bypass IP rate limits.
 * - When trustProxy is true, the nearest (leftmost trusted) proxy hop is used.
 * - In development/test mode without a proxy, explicit X-Dev-Client-Id or user-agent
 *   is accepted solely to prevent test isolation collisions.
 */
export function getClientIdentifier(request: Request, options: ClientIdentifierOptions = {}): string {
  const trustProxy = options.trustProxy ?? (process.env.TRUST_PROXY === 'true');
  const isProd = (options.environment ?? process.env.NODE_ENV) === 'production';

  if (trustProxy) {
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      const ips = xForwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean);
      if (ips.length > 0) {
        return ips[0];
      }
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp && realIp.trim()) {
      return realIp.trim();
    }

    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    if (cfConnectingIp && cfConnectingIp.trim()) {
      return cfConnectingIp.trim();
    }
  }

  // In development/test mode without proxy trust:
  // Allow test suites to pass X-Dev-Client-Id or use User-Agent to isolate test buckets.
  // This is strictly for local dev/testing and is rejected in production.
  if (!isProd) {
    const devClientId = request.headers.get('x-dev-client-id');
    if (devClientId && devClientId.trim()) {
      return `dev-client:${devClientId.trim()}`;
    }

    const userAgent = request.headers.get('user-agent');
    if (userAgent && userAgent.trim()) {
      return `dev-ua:${userAgent.trim().slice(0, 32)}`;
    }
  }

  // Safe fallback identifier for untrusted proxy environment
  return 'untrusted-client-boundary';
}

// Global development rate limiter instance
const defaultDevRateLimiter = new DevMemoryRateLimiter();

/**
 * Resolves the rate limiter implementation.
 * 
 * RULES:
 * - In production: If distributed infrastructure (Redis) is not configured, returns
 *   UnavailableProductionRateLimiter (fails closed visibly). Production NEVER silently falls back
 *   to DevMemoryRateLimiter.
 * - In development/test: Returns DevMemoryRateLimiter.
 */
export function getRateLimiter(environment = process.env.NODE_ENV): RateLimiter {
  if (environment === 'production') {
    // Production distributed rate limiter (e.g. Redis) is pending Gate 0C/infrastructure setup.
    // Production MUST NOT pretend to be protected by a non-distributed in-memory limiter.
    return new UnavailableProductionRateLimiter();
  }

  return defaultDevRateLimiter;
}
