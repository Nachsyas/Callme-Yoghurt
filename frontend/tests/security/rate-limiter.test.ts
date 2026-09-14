import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DevMemoryRateLimiter,
  UnavailableProductionRateLimiter,
  getClientIdentifier,
  getRateLimiter,
} from '../../src/lib/security/rate-limit.ts';

describe('Rate Limiter Foundation & Safe Client Identification', () => {
  let limiter: DevMemoryRateLimiter;

  beforeEach(() => {
    limiter = new DevMemoryRateLimiter();
  });

  describe('DevMemoryRateLimiter window behavior', () => {
    it('allows requests up to the configured limit within the window', async () => {
      const key = 'test:client-1';
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
      assert.ok(r4.retryAfter > 0, 'retryAfter must be greater than 0');
    });

    it('isolates counters between different rate limit keys', async () => {
      await limiter.check('key:alpha', 1, 10);
      const blockedAlpha = await limiter.check('key:alpha', 1, 10);
      assert.equal(blockedAlpha.success, false);

      const freshBeta = await limiter.check('key:beta', 1, 10);
      assert.equal(freshBeta.success, true);
    });
  });

  describe('Production rate-limiter safety invariants', () => {
    it('proves production cannot silently use DevMemoryRateLimiter', () => {
      const prodLimiter = getRateLimiter('production');
      assert.equal(prodLimiter.type, 'unavailable');
      assert.ok(
        prodLimiter instanceof UnavailableProductionRateLimiter,
        'Production must instantiate UnavailableProductionRateLimiter when distributed store is not configured',
      );
      assert.ok(
        !(prodLimiter instanceof DevMemoryRateLimiter),
        'Production must NEVER silently use DevMemoryRateLimiter',
      );
    });

    it('proves production rate limiter fails closed safely and visibly', async () => {
      const prodLimiter = getRateLimiter('production');
      const result = await prodLimiter.check('any-key', 5, 60);

      assert.equal(result.success, false, 'Unavailable production limiter must fail closed');
      assert.equal(result.remaining, 0);
      assert.ok(result.retryAfter > 0);
    });

    it('provides DevMemoryRateLimiter for development and test environments', () => {
      const devLimiter = getRateLimiter('development');
      assert.equal(devLimiter.type, 'development-memory');
      assert.ok(devLimiter instanceof DevMemoryRateLimiter);
    });
  });

  describe('Safe client identifier signals (anti-spoofing & dev isolation)', () => {
    it('does not trust spoofed X-Forwarded-For when trustProxy is false (default)', () => {
      const spoofedRequest = new Request('http://localhost:3000/api/checkout', {
        headers: {
          'x-forwarded-for': '203.0.113.50, 198.51.100.1',
          'x-real-ip': '203.0.113.50',
        },
      });

      const clientId = getClientIdentifier(spoofedRequest, { trustProxy: false, environment: 'production' });
      assert.notEqual(clientId, '203.0.113.50');
      assert.equal(clientId, 'untrusted-client-boundary');
    });

    it('extracts client IP from proxy chain only when trustProxy is explicitly true', () => {
      const proxyRequest = new Request('http://localhost:3000/api/checkout', {
        headers: {
          'x-forwarded-for': '198.51.100.25, 10.0.0.1',
        },
      });

      const clientId = getClientIdentifier(proxyRequest, { trustProxy: true });
      assert.equal(clientId, '198.51.100.25');
    });

    it('isolates unrelated development test identities via X-Dev-Client-Id in dev mode', () => {
      const devReqA = new Request('http://localhost:3000/api/checkout', {
        headers: {
          'x-dev-client-id': 'suite-run-alpha',
          'x-forwarded-for': '1.2.3.4', // Ignored because trustProxy=false
        },
      });

      const devReqB = new Request('http://localhost:3000/api/checkout', {
        headers: {
          'x-dev-client-id': 'suite-run-beta',
          'x-forwarded-for': '5.6.7.8', // Ignored because trustProxy=false
        },
      });

      const idA = getClientIdentifier(devReqA, { trustProxy: false, environment: 'development' });
      const idB = getClientIdentifier(devReqB, { trustProxy: false, environment: 'development' });

      assert.equal(idA, 'dev-client:suite-run-alpha');
      assert.equal(idB, 'dev-client:suite-run-beta');
      assert.notEqual(idA, idB, 'Different dev identities must not collide into a single bucket');
    });

    it('ignores development test identity header in production mode', () => {
      const req = new Request('http://localhost:3000/api/checkout', {
        headers: {
          'x-dev-client-id': 'attacker-trying-to-bypass-key',
        },
      });

      const id = getClientIdentifier(req, { trustProxy: false, environment: 'production' });
      assert.equal(id, 'untrusted-client-boundary', 'Production must ignore dev-only client header');
    });
  });
});
