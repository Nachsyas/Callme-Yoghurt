import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  DevMemoryRateLimiter,
  UnavailableProductionRateLimiter,
  RedisRateLimiter,
  MockRedisClient,
  sanitizeRedisUrl,
  type RedisClientContract,
  getClientIdentifier,
  getRateLimiter,
} from "../../src/lib/security/rate-limit.ts";

describe("Rate Limiter Foundation & Safe Client Identification", () => {
  let limiter: DevMemoryRateLimiter;

  beforeEach(() => {
    limiter = new DevMemoryRateLimiter();
  });

  describe("DevMemoryRateLimiter window behavior", () => {
    it("allows requests up to the configured limit within the window", async () => {
      const key = "test:client-1";
      const limit = 3;
      const windowSeconds = 10;

      const r1 = await limiter.check(key, limit, windowSeconds);
      assert.equal(r1.success, true);
      assert.equal(r1.remaining, 2);

      const r2 = await limiter.check(key, limit, windowSeconds);
      assert.equal(r2.success, true);
      assert.equal(r2.remaining, 1);

      const r3 = await limiter.check(key, limit, windowSeconds);
      assert.equal(r3.success, true);
      assert.equal(r3.remaining, 0);

      // 4th request must be rejected
      const r4 = await limiter.check(key, limit, windowSeconds);
      assert.equal(r4.success, false);
      assert.equal(r4.remaining, 0);
      assert.ok(r4.retryAfter > 0, "retryAfter must be greater than 0");
    });

    it("isolates counters between different rate limit keys", async () => {
      await limiter.check("key:alpha", 1, 10);
      const blockedAlpha = await limiter.check("key:alpha", 1, 10);
      assert.equal(blockedAlpha.success, false);

      const freshBeta = await limiter.check("key:beta", 1, 10);
      assert.equal(freshBeta.success, true);
    });
  });

  describe("Production rate-limiter safety invariants", () => {
    it("proves production cannot silently use DevMemoryRateLimiter", () => {
      const prodLimiter = getRateLimiter("production", { redisUrl: undefined });
      assert.equal(prodLimiter.type, "unavailable");
      assert.ok(
        prodLimiter instanceof UnavailableProductionRateLimiter,
        "Production must instantiate UnavailableProductionRateLimiter when distributed store is not configured"
      );
      assert.ok(
        !(prodLimiter instanceof DevMemoryRateLimiter),
        "Production must NEVER silently use DevMemoryRateLimiter"
      );
    });

    it("proves production rate limiter fails closed safely and visibly", async () => {
      const prodLimiter = getRateLimiter("production", { redisUrl: undefined });
      const result = await prodLimiter.check("any-key", 5, 60);

      assert.equal(result.success, false, "Unavailable production limiter must fail closed");
      assert.equal(result.remaining, 0);
      assert.ok(result.retryAfter > 0);
    });

    it("provides DevMemoryRateLimiter for development and test environments", () => {
      const devLimiter = getRateLimiter("development");
      assert.equal(devLimiter.type, "development-memory");
      assert.ok(devLimiter instanceof DevMemoryRateLimiter);
    });

    it("proves production with configured Redis resolves to RedisRateLimiter", () => {
      const mockClient = new MockRedisClient();
      const prodLimiter = getRateLimiter("production", { redisClient: mockClient });
      assert.equal(prodLimiter.type, "production-distributed");
      assert.ok(prodLimiter instanceof RedisRateLimiter);
    });
  });

  describe("RedisRateLimiter distributed behavior (Gate 0B Final)", () => {
    it("Test 1: proves Redis limiter respects limit boundary (5 allowed, 6th rejected)", async () => {
      const mockClient = new MockRedisClient();
      const redisLimiter = new RedisRateLimiter({ client: mockClient });
      const key = "test:boundary-check";
      const limit = 5;
      const windowSeconds = 60;

      for (let i = 1; i <= limit; i++) {
        const res = await redisLimiter.check(key, limit, windowSeconds);
        assert.equal(res.success, true, `Request ${i} of ${limit} must be allowed`);
        assert.equal(res.limit, 5);
        assert.equal(res.remaining, 5 - i);
        assert.equal(res.retryAfter, 0);
        assert.ok(res.resetAt > Math.floor(Date.now() / 1000));
      }

      // 6th request must be rejected with HTTP 429 semantics
      const res6 = await redisLimiter.check(key, limit, windowSeconds);
      assert.equal(res6.success, false, "6th request must exceed limit");
      assert.equal(res6.limit, 5);
      assert.equal(res6.remaining, 0);
      assert.ok(res6.retryAfter > 0, "retryAfter must be greater than 0 on 429");
    });

    it("Test 2: proves TTL expiration resets counter and allows new requests", async () => {
      const mockClient = new MockRedisClient();
      const redisLimiter = new RedisRateLimiter({ client: mockClient });
      const key = "test:ttl-reset";
      const limit = 2;
      const windowSeconds = 10;

      // Exhaust limit
      await redisLimiter.check(key, limit, windowSeconds);
      await redisLimiter.check(key, limit, windowSeconds);
      const blocked = await redisLimiter.check(key, limit, windowSeconds);
      assert.equal(blocked.success, false);

      // Simulate TTL expiration in Redis
      mockClient.expireKey(`callme:ratelimit:${key}`);

      // Request after expiration must be accepted
      const fresh = await redisLimiter.check(key, limit, windowSeconds);
      assert.equal(fresh.success, true, "Request after TTL reset must be allowed");
      assert.equal(fresh.remaining, 1);
      assert.equal(fresh.retryAfter, 0);
    });

    it("Test 3: proves production without Redis configuration fails closed without fallback", async () => {
      const originalEnv = process.env.REDIS_URL;
      delete process.env.REDIS_URL;

      try {
        const prodLimiter = getRateLimiter("production", { redisUrl: undefined });
        assert.equal(prodLimiter.type, "unavailable");
        assert.ok(prodLimiter instanceof UnavailableProductionRateLimiter);
        assert.ok(
          !(prodLimiter instanceof DevMemoryRateLimiter),
          "Production must NEVER fall back to in-memory limiter"
        );

        const checkRes = await prodLimiter.check("critical-route", 10, 60);
        assert.equal(checkRes.success, false, "Must fail closed when Redis is missing");
        assert.equal(checkRes.remaining, 0);
        assert.equal(checkRes.retryAfter, 60);
      } finally {
        if (originalEnv !== undefined) {
          process.env.REDIS_URL = originalEnv;
        }
      }
    });

    it("Test 4: proves concurrent requests do not bypass limit via atomic increment", async () => {
      const mockClient = new MockRedisClient();
      const redisLimiter = new RedisRateLimiter({ client: mockClient });
      const key = "test:atomic-concurrency";
      const limit = 10;
      const windowSeconds = 60;
      const totalRequests = 25;

      // Dispatch 25 concurrent requests simultaneously
      const promises = Array.from({ length: totalRequests }, () =>
        redisLimiter.check(key, limit, windowSeconds)
      );

      const results = await Promise.all(promises);

      const allowed = results.filter((r) => r.success);
      const rejected = results.filter((r) => !r.success);

      assert.equal(allowed.length, 10, "Atomic EVAL script must allow exactly 10 requests");
      assert.equal(rejected.length, 15, "Atomic EVAL script must reject exactly 15 requests");

      for (const r of rejected) {
        assert.equal(r.remaining, 0);
        assert.ok(r.retryAfter > 0);
      }
    });

    it("proves Redis execution/transport failure fails closed safely", async () => {
      const failingClient: RedisClientContract = {
        async eval() {
          throw new Error("Redis connection dropped by peer");
        },
      };

      const redisLimiter = new RedisRateLimiter({ client: failingClient });
      const res = await redisLimiter.check("failover-key", 5, 60);

      assert.equal(res.success, false, "Must fail closed on Redis infrastructure failure");
      assert.equal(res.remaining, 0);
      assert.equal(res.retryAfter, 60);
    });

    it("proves sanitizeRedisUrl redacts passwords from credentials", () => {
      const redisUrl = "redis://:super_secret_redis_pw@10.0.0.5:6379/1";
      const sanitized = sanitizeRedisUrl(redisUrl);
      assert.ok(!sanitized.includes("super_secret_redis_pw"), "Must not contain raw password");
      assert.ok(sanitized.includes("***"), "Must contain asterisk mask");

      const redissUrl = "rediss://callme_user:topsecret@cloud.upstash.com:6380";
      const sanitizedTls = sanitizeRedisUrl(redissUrl);
      assert.ok(!sanitizedTls.includes("topsecret"), "Must not contain raw password in rediss://");
      assert.ok(sanitizedTls.includes("***"), "Must contain asterisk mask");
    });
  });

  describe("Safe client identifier signals (anti-spoofing & dev isolation)", () => {
    it("does not trust spoofed X-Forwarded-For when trustProxy is false (default)", () => {
      const spoofedRequest = new Request("http://localhost:3000/api/checkout", {
        headers: {
          "x-forwarded-for": "203.0.113.50, 198.51.100.1",
          "x-real-ip": "203.0.113.50",
        },
      });

      const clientId = getClientIdentifier(spoofedRequest, { trustProxy: false, environment: "production" });
      assert.notEqual(clientId, "203.0.113.50");
      assert.equal(clientId, "untrusted-client-boundary");
    });

    it("extracts client IP from proxy chain only when trustProxy is explicitly true", () => {
      const proxyRequest = new Request("http://localhost:3000/api/checkout", {
        headers: {
          "x-forwarded-for": "198.51.100.25, 10.0.0.1",
        },
      });

      const clientId = getClientIdentifier(proxyRequest, { trustProxy: true });
      assert.equal(clientId, "198.51.100.25");
    });

    it("isolates unrelated development test identities via X-Dev-Client-Id in dev mode", () => {
      const devReqA = new Request("http://localhost:3000/api/checkout", {
        headers: {
          "x-dev-client-id": "suite-run-alpha",
          "x-forwarded-for": "1.2.3.4",
        },
      });

      const devReqB = new Request("http://localhost:3000/api/checkout", {
        headers: {
          "x-dev-client-id": "suite-run-beta",
          "x-forwarded-for": "5.6.7.8",
        },
      });

      const idA = getClientIdentifier(devReqA, { trustProxy: false, environment: "development" });
      const idB = getClientIdentifier(devReqB, { trustProxy: false, environment: "development" });

      assert.equal(idA, "dev-client:suite-run-alpha");
      assert.equal(idB, "dev-client:suite-run-beta");
      assert.notEqual(idA, idB, "Different dev identities must not collide into a single bucket");
    });

    it("ignores development test identity header in production mode", () => {
      const req = new Request("http://localhost:3000/api/checkout", {
        headers: {
          "x-dev-client-id": "attacker-trying-to-bypass-key",
        },
      });

      const id = getClientIdentifier(req, { trustProxy: false, environment: "production" });
      assert.equal(id, "untrusted-client-boundary", "Production must ignore dev-only client header");
    });
  });
});
