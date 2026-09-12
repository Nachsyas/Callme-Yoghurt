import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DevMemoryRateLimiter,
  getClientIdentifier,
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

  describe('Safe client identifier signals (anti-spoofing)', () => {
    it('does not trust spoofed X-Forwarded-For when trustProxy is false (default)', () => {
      const spoofedRequest = new Request('http://localhost:3000/api/checkout', {
        headers: {
          'x-forwarded-for': '203.0.113.50, 198.51.100.1',
          'x-real-ip': '203.0.113.50',
        },
      });

      const clientId = getClientIdentifier(spoofedRequest, { trustProxy: false });
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
  });
});
