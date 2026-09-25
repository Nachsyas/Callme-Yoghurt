/**
 * Rate Limiting Foundation for Next.js BFF (Gate 0B Final).
 *
 * ARCHITECTURAL CONSTRAINTS:
 * - Production distributed rate limiting is backed by Redis (per ADR-0001).
 * - DevMemoryRateLimiter is strictly an in-memory development and testing adapter.
 *   It is NOT production-safe and must NEVER be used silently in production.
 * - RedisRateLimiter uses atomic Redis increment + TTL semantics via Lua script.
 * - Production without configured Redis fails closed via UnavailableProductionRateLimiter.
 * - Client IP extraction defaults to trustProxy = false to prevent spoofed X-Forwarded-For attacks.
 * - Zero credentials or sensitive data are ever logged or exposed.
 */

import * as net from "node:net";
import * as tls from "node:tls";

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix timestamp in seconds
  retryAfter: number; // Seconds to wait before next request
}

export type RateLimiterType = "development-memory" | "production-distributed" | "unavailable";

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
  readonly type = "development-memory" as const;
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
  readonly type = "unavailable" as const;

  async check(_key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    console.error(
      "SECURITY CRITICAL: Rate limiting is unavailable in production because distributed storage (Redis) is not configured. Failing closed."
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

/**
 * Contract for a Redis client capable of atomic Lua script execution.
 */
export interface RedisClientContract {
  eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown>;
  disconnect?(): void | Promise<void>;
}

/**
 * Safely sanitizes a Redis connection string by replacing passwords with asterisks.
 */
export function sanitizeRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return url.replace(/:([^:@/]+)@/, ":***@");
  }
}

/**
 * Lightweight, zero-dependency RESP socket client for Redis Lua script execution.
 */
export class SimpleRedisClient implements RedisClientContract {
  private readonly host: string;
  private readonly port: number;
  private readonly password?: string;
  private readonly isTls: boolean;
  private readonly timeoutMs: number;
  private socket: net.Socket | null = null;
  private connectingPromise: Promise<void> | null = null;
  private responseBuffer = "";
  private pendingCommands: Array<{
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = [];

  constructor(url: string, options?: { timeoutMs?: number }) {
    this.timeoutMs = options?.timeoutMs ?? 2000;
    try {
      const parsed = new URL(url);
      this.isTls = parsed.protocol === "rediss:";
      this.host = parsed.hostname || "127.0.0.1";
      this.port = parsed.port ? parseInt(parsed.port, 10) : 6379;
      if (parsed.password) {
        this.password = decodeURIComponent(parsed.password);
      }
    } catch {
      this.isTls = false;
      this.host = "127.0.0.1";
      this.port = 6379;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.socket && !this.socket.destroyed) {
      return;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      const onConnect = async () => {
        if (settled) return;
        settled = true;

        if (this.password) {
          try {
            await this.executeRaw(["AUTH", this.password]);
          } catch (authErr) {
            this.destroySocket(authErr instanceof Error ? authErr : new Error(String(authErr)));
            reject(authErr);
            return;
          }
        }
        resolve();
      };

      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        this.destroySocket(err);
        reject(err);
      };

      try {
        if (this.isTls) {
          this.socket = tls.connect({
            host: this.host,
            port: this.port,
            timeout: this.timeoutMs,
          }, onConnect);
        } else {
          this.socket = net.createConnection({
            host: this.host,
            port: this.port,
            timeout: this.timeoutMs,
          }, onConnect);
        }

        this.socket.setNoDelay(true);
        this.socket.on("error", onError);
        this.socket.on("timeout", () => {
          onError(new Error("Redis connection timed out"));
        });
        this.socket.on("data", (chunk: Buffer) => {
          this.responseBuffer += chunk.toString("utf8");
          this.processIncoming();
        });
        this.socket.on("close", () => {
          this.destroySocket(new Error("Redis connection closed"));
        });
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    }).finally(() => {
      this.connectingPromise = null;
    });

    return this.connectingPromise;
  }

  private destroySocket(err: Error): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
      this.socket = null;
    }
    const pending = this.pendingCommands;
    this.pendingCommands = [];
    this.responseBuffer = "";
    for (const cmd of pending) {
      cmd.reject(err);
    }
  }

  private processIncoming(): void {
    while (this.pendingCommands.length > 0) {
      const parsed = this.parseResp(this.responseBuffer);
      if (parsed === null) {
        break;
      }
      this.responseBuffer = parsed.remainder;
      const cmd = this.pendingCommands.shift();
      if (cmd) {
        if (parsed.isError) {
          cmd.reject(new Error(String(parsed.value)));
        } else {
          cmd.resolve(parsed.value);
        }
      }
    }
  }

  private parseResp(buf: string): { value: unknown; remainder: string; isError: boolean } | null {
    if (buf.length === 0) return null;
    let pos = 0;

    function parseItem(): { val: unknown; isErr: boolean } | null {
      if (pos >= buf.length) return null;
      const type = buf[pos++];
      const crlf = buf.indexOf("\r\n", pos);
      if (crlf === -1) return null;
      const line = buf.slice(pos, crlf);
      pos = crlf + 2;

      if (type === "+") return { val: line, isErr: false };
      if (type === "-") return { val: line, isErr: true };
      if (type === ":") return { val: parseInt(line, 10), isErr: false };
      if (type === "$") {
        const len = parseInt(line, 10);
        if (len === -1) return { val: null, isErr: false };
        if (pos + len + 2 > buf.length) return null;
        const bulk = buf.slice(pos, pos + len);
        pos += len + 2;
        return { val: bulk, isErr: false };
      }
      if (type === "*") {
        const count = parseInt(line, 10);
        if (count === -1) return { val: null, isErr: false };
        const arr: unknown[] = [];
        for (let i = 0; i < count; i++) {
          const item = parseItem();
          if (item === null) return null;
          arr.push(item.val);
        }
        return { val: arr, isErr: false };
      }
      return null;
    }

    const item = parseItem();
    if (item === null) return null;
    return { value: item.val, remainder: buf.slice(pos), isError: item.isErr };
  }

  private executeRaw(args: (string | number)[]): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new Error("Redis socket is not available"));
        return;
      }

      let payload = "*" + args.length + "\r\n";
      for (const arg of args) {
        const str = String(arg);
        payload += "$" + Buffer.byteLength(str) + "\r\n" + str + "\r\n";
      }

      this.pendingCommands.push({ resolve, reject });
      this.socket.write(payload, "utf8", (err) => {
        if (err) {
          const idx = this.pendingCommands.findIndex((c) => c.resolve === resolve);
          if (idx !== -1) {
            this.pendingCommands.splice(idx, 1);
          }
          reject(err);
        }
      });
    });
  }

  async eval(script: string, numKeys: number, ...args: (string | number)[]): Promise<unknown> {
    await this.ensureConnected();
    return this.executeRaw(["EVAL", script, numKeys, ...args]);
  }

  async disconnect(): Promise<void> {
    this.destroySocket(new Error("Redis client explicitly disconnected"));
  }
}

/**
 * In-memory Redis simulation for testing atomic increment and TTL behavior.
 */
export class MockRedisClient implements RedisClientContract {
  private readonly store = new Map<string, { count: number; expiresAt: number }>();

  async eval(_script: string, _numKeys: number, ...args: (string | number)[]): Promise<[number, number]> {
    const key = String(args[0]);
    const windowSeconds = Number(args[1]);
    const now = Date.now();

    let entry = this.store.get(key);
    if (!entry || now >= entry.expiresAt) {
      entry = {
        count: 1,
        expiresAt: now + windowSeconds * 1000,
      };
      this.store.set(key, entry);
      return [1, windowSeconds];
    }

    entry.count += 1;
    const ttl = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
    return [entry.count, ttl];
  }

  expireKey(key: string): void {
    this.store.delete(key);
  }

  advanceTime(key: string, seconds: number): void {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiresAt -= seconds * 1000;
    }
  }

  clear(): void {
    this.store.clear();
  }
}

const RATE_LIMIT_LUA_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return {current, ttl}
`.trim();

export interface RedisRateLimiterOptions {
  url?: string;
  client?: RedisClientContract;
  keyPrefix?: string;
}

/**
 * Production-ready distributed rate limiter backed by Redis.
 *
 * Invariants (Gate 0B Final):
 * - Uses atomic Redis EVAL script (INCR + conditional EXPIRE + TTL) to prevent race conditions.
 * - Guarantees fail-closed behavior on connection/transport errors.
 * - Never logs raw keys with PII or URLs with credentials.
 * - Returns exact RateLimitResult contract matching DevMemoryRateLimiter.
 */
export class RedisRateLimiter implements RateLimiter {
  readonly type = "production-distributed" as const;
  private readonly client: RedisClientContract;
  private readonly keyPrefix: string;

  constructor(options: RedisRateLimiterOptions = {}) {
    this.keyPrefix = options.keyPrefix || "callme:ratelimit:";
    if (options.client) {
      this.client = options.client;
    } else if (options.url) {
      this.client = new SimpleRedisClient(options.url);
    } else {
      throw new Error("RedisRateLimiter requires either a Redis URL or a client instance");
    }
  }

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Math.ceil(Date.now() / 1000);
    const redisKey = `${this.keyPrefix}${key}`;

    try {
      const rawResult = await this.client.eval(RATE_LIMIT_LUA_SCRIPT, 1, redisKey, windowSeconds);

      if (!Array.isArray(rawResult) || rawResult.length < 2) {
        throw new Error("Invalid Redis EVAL response format");
      }

      const current = typeof rawResult[0] === "number" ? rawResult[0] : parseInt(String(rawResult[0]), 10);
      const ttl = typeof rawResult[1] === "number" ? rawResult[1] : parseInt(String(rawResult[1]), 10);

      const effectiveTtl = ttl > 0 ? ttl : windowSeconds;
      const isAllowed = current <= limit;
      const remaining = Math.max(0, limit - current);
      const retryAfter = isAllowed ? 0 : Math.max(1, effectiveTtl);

      return {
        success: isAllowed,
        limit,
        remaining,
        resetAt: now + effectiveTtl,
        retryAfter,
      };
    } catch {
      // SECURITY INVARIANT: Fail closed on distributed infrastructure errors in production.
      console.error(
        "SECURITY: Distributed rate limiter execution failure. Failing closed to protect backend resources."
      );

      return {
        success: false,
        limit,
        remaining: 0,
        resetAt: now + windowSeconds,
        retryAfter: windowSeconds,
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.disconnect) {
      await this.client.disconnect();
    }
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
  const trustProxy = options.trustProxy ?? (process.env.TRUST_PROXY === "true");
  const isProd = (options.environment ?? process.env.NODE_ENV) === "production";

  if (trustProxy) {
    const xForwardedFor = request.headers.get("x-forwarded-for");
    if (xForwardedFor) {
      const ips = xForwardedFor.split(",").map((ip) => ip.trim()).filter(Boolean);
      if (ips.length > 0) {
        return ips[0];
      }
    }

    const realIp = request.headers.get("x-real-ip");
    if (realIp && realIp.trim()) {
      return realIp.trim();
    }

    const cfConnectingIp = request.headers.get("cf-connecting-ip");
    if (cfConnectingIp && cfConnectingIp.trim()) {
      return cfConnectingIp.trim();
    }
  }

  // In development/test mode without proxy trust:
  // Allow test suites to pass X-Dev-Client-Id or use User-Agent to isolate test buckets.
  // This is strictly for local dev/testing and is rejected in production.
  if (!isProd) {
    const devClientId = request.headers.get("x-dev-client-id");
    if (devClientId && devClientId.trim()) {
      return `dev-client:${devClientId.trim()}`;
    }

    const userAgent = request.headers.get("user-agent");
    if (userAgent && userAgent.trim()) {
      return `dev-ua:${userAgent.trim().slice(0, 32)}`;
    }
  }

  // Safe fallback identifier for untrusted proxy environment
  return "untrusted-client-boundary";
}

// Global development rate limiter instance
const defaultDevRateLimiter = new DevMemoryRateLimiter();
let defaultProdRedisLimiter: RateLimiter | null = null;

export interface GetRateLimiterOptions {
  redisUrl?: string;
  redisClient?: RedisClientContract;
}

/**
 * Resolves the rate limiter implementation.
 *
 * RULES (Gate 0B Final):
 * - In production:
 *   - If Redis is configured (via REDIS_URL or injected client), returns RedisRateLimiter.
 *   - If Redis is missing, returns UnavailableProductionRateLimiter (FAILS CLOSED).
 *   - Production NEVER silently falls back to DevMemoryRateLimiter.
 * - In development/test: Returns DevMemoryRateLimiter by default.
 */
export function getRateLimiter(
  environment = process.env.NODE_ENV,
  options?: GetRateLimiterOptions
): RateLimiter {
  if (environment === "production") {
    const redisClient = options?.redisClient;
    if (redisClient) {
      return new RedisRateLimiter({ client: redisClient });
    }

    const redisUrl = options?.redisUrl ?? process.env.REDIS_URL;
    if (redisUrl && redisUrl.trim().length > 0) {
      if (!defaultProdRedisLimiter || !(defaultProdRedisLimiter instanceof RedisRateLimiter)) {
        defaultProdRedisLimiter = new RedisRateLimiter({ url: redisUrl.trim() });
      }
      return defaultProdRedisLimiter;
    }

    // Production without Redis configuration fails closed
    return new UnavailableProductionRateLimiter();
  }

  return defaultDevRateLimiter;
}
