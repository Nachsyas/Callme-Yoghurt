import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../../src/app/api/checkout/route.ts';
import { getRateLimiter, DevMemoryRateLimiter } from '../../src/lib/security/rate-limit.ts';
import { getSecurityHeaders } from '../../src/lib/security/headers.ts';

describe('Checkout Route Security Baseline (Gate 0B Regression Suite)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const testSecretToken = 'super-secret-erp-internal-bearer-token-12345';
  const testErpUrl = 'http://erp-core-internal.local';

  beforeEach(() => {
    process.env.ERP_INTERNAL_URL = testErpUrl;
    process.env.ERP_SERVICE_TOKEN = testSecretToken;
    process.env.TRUST_PROXY = 'false';

    // Clear rate limiter memory buckets between test runs
    const limiter = getRateLimiter();
    if (limiter instanceof DevMemoryRateLimiter) {
      limiter.clear();
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  function makeValidPayload() {
    return {
      customer: {
        name: 'Budi Santoso',
        whatsapp: '081234567890',
        address: 'Jl. Merdeka No. 10, Jakarta Pusat',
      },
      items: [
        {
          variant_id: 'var-yoghurt-plain-250',
          quantity: 2,
        },
      ],
      delivery_method: 'instant',
    };
  }

  // 1. Internal ERP service credentials never appear in client responses
  it('proves internal ERP service credentials never appear in client responses', async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ order_number: 'SO-TEST-001' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    const bodyText = await res.text();

    assert.ok(
      !bodyText.includes(testSecretToken),
      'Client response must never expose internal service bearer token',
    );
  });

  // 2. No fallback internal secret is accepted
  it('proves no fallback internal secret is accepted when environment variable is missing', async () => {
    delete process.env.ERP_SERVICE_TOKEN;

    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 503, 'Must fail closed with 503 when ERP token is missing');
    assert.equal(fetchCalled, false, 'Fetch must never be called with a hardcoded fallback token');
  });

  // 3. Malformed checkout payload is rejected
  it('proves malformed checkout payloads are rejected with HTTP 400', async () => {
    const malformedInputs = [
      {}, // Empty body
      { customer: null, items: [] },
      { customer: { name: '', whatsapp: '081', address: 'addr' }, items: [{ variant_id: 'v1', quantity: 1 }], delivery_method: 'instant' },
      { customer: { name: 'A', whatsapp: '', address: 'addr' }, items: [{ variant_id: 'v1', quantity: 1 }], delivery_method: 'instant' },
      { customer: { name: 'A', whatsapp: '081', address: '' }, items: [{ variant_id: 'v1', quantity: 1 }], delivery_method: 'instant' },
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [], delivery_method: 'instant' }, // Empty items
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [{ variant_id: 'v1', quantity: 0 }], delivery_method: 'instant' }, // 0 qty
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [{ variant_id: 'v1', quantity: -5 }], delivery_method: 'instant' }, // Negative qty
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [{ variant_id: 'v1', quantity: 1.5 }], delivery_method: 'instant' }, // Non-integer
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [{ variant_id: 'v1', quantity: 1 }], delivery_method: 'teleport' }, // Invalid delivery method
    ];

    for (const input of malformedInputs) {
      const limiter = getRateLimiter();
      if (limiter instanceof DevMemoryRateLimiter) {
        limiter.clear();
      }

      const req = new Request('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const res = await POST(req);
      assert.equal(res.status, 400, `Expected 400 for input: ${JSON.stringify(input)}`);
    }

    const limiter = getRateLimiter();
    if (limiter instanceof DevMemoryRateLimiter) {
      limiter.clear();
    }

    // Invalid JSON string test
    const badJsonReq = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json-string',
    });
    const badJsonRes = await POST(badJsonReq);
    assert.equal(badJsonRes.status, 400);
  });

  // 4. Unsupported/unexpected input does not silently become authoritative transaction data
  it('proves client-injected pricing, discounts, and roles are stripped before ERP forwarding', async () => {
    let capturedUpstreamBody: Record<string, unknown> | null = null;

    globalThis.fetch = async (_url, init) => {
      if (init && init.body) {
        capturedUpstreamBody = JSON.parse(init.body as string);
      }
      return new Response(JSON.stringify({ order_id: 'ord-safe-001' }), { status: 200 });
    };

    const tamperedPayload = {
      customer: {
        name: 'Attacker',
        whatsapp: '08123456789',
        address: 'Attacker Hideout',
        is_admin: true, // Tampered permission
        role: 'SUPERADMIN',
      },
      items: [
        {
          variant_id: 'var-yoghurt-1000',
          quantity: 5,
          price: 0, // Tampered price
          total: 0,
          discount_amount: 1000000,
        },
      ],
      delivery_method: 'sameday',
      total_amount: 0, // Tampered total
      status: 'PAID', // Tampered state
      payment_confirmed: true,
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tamperedPayload),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    assert.ok(capturedUpstreamBody, 'ERP fetch must have been called');

    // Verify tampered transaction values were completely stripped
    const upstream = capturedUpstreamBody as Record<string, unknown>;
    assert.equal(upstream.total_amount, undefined, 'Client-provided total_amount must not be forwarded');
    assert.equal(upstream.status, undefined, 'Client-provided status must not be forwarded');
    assert.equal(upstream.payment_confirmed, undefined, 'Client-provided payment_confirmed must not be forwarded');

    const customer = upstream.customer as Record<string, unknown>;
    assert.equal(customer.is_admin, undefined, 'Client-provided is_admin must not be forwarded');
    assert.equal(customer.role, undefined, 'Client-provided role must not be forwarded');

    const items = upstream.items as Array<Record<string, unknown>>;
    assert.equal(items[0].price, undefined, 'Client-provided price must not be forwarded');
    assert.equal(items[0].total, undefined, 'Client-provided total must not be forwarded');
    assert.equal(items[0].discount_amount, undefined, 'Client-provided discount must not be forwarded');
  });

  // 5. Missing internal ERP configuration fails closed
  it('proves missing ERP internal URL fails closed with HTTP 503', async () => {
    delete process.env.ERP_INTERNAL_URL;

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, 'Checkout service is temporarily unavailable');
  });

  // 6. Upstream internal error bodies/secrets are not leaked
  it('proves upstream error traces and internal database URLs are never leaked to client', async () => {
    globalThis.fetch = async () => {
      // Simulate upstream crash leaking DB credentials in trace
      const internalLeak = {
        message: 'SQLSTATE[08006] Connection failure: postgresql://callme_admin:SuperSecretDbPassword123@10.0.1.25:5432/callme_yoghurt_prod',
        trace: [
          '#0 /var/www/app/Domain/Sales/OrderService.php(104): PDO->__construct()',
          '#1 /var/www/app/Http/Controllers/InternalOrderController.php(42): ...',
        ],
      };

      return new Response(JSON.stringify(internalLeak), { status: 500 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 502, 'Must map upstream 500 to sanitized 502 Bad Gateway');

    const bodyText = await res.text();
    assert.ok(!bodyText.includes('SuperSecretDbPassword123'), 'Must never leak database password');
    assert.ok(!bodyText.includes('postgresql://'), 'Must never leak connection URI');
    assert.ok(!bodyText.includes('SQLSTATE'), 'Must never leak internal SQL error');
    assert.ok(!bodyText.includes('OrderService.php'), 'Must never leak internal filesystem paths');

    const json = JSON.parse(bodyText) as { error: string; request_id: string };
    assert.equal(json.error, 'Unable to process checkout');
    assert.ok(json.request_id, 'Must provide sanitized correlation request_id');
  });

  // 7. Rate limiting behavior works at its defined boundary
  it('proves rate limiting boundary enforces HTTP 429 when threshold is exceeded', async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    };

    // The limit is 5 requests per minute
    for (let i = 1; i <= 5; i++) {
      const req = new Request('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(makeValidPayload()),
      });

      const res = await POST(req);
      assert.equal(res.status, 200, `Request ${i} of 5 should succeed`);
      assert.equal(res.headers.get('x-ratelimit-limit'), '5');
      assert.equal(res.headers.get('x-ratelimit-remaining'), String(5 - i));
    }

    // 6th request must exceed rate limit
    const blockedReq = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeValidPayload()),
    });

    const blockedRes = await POST(blockedReq);
    assert.equal(blockedRes.status, 429, '6th request must be rejected with 429');
    assert.ok(blockedRes.headers.get('retry-after'), 'Retry-After header must be present on 429');

    const blockedBody = (await blockedRes.json()) as { error: string };
    assert.ok(blockedBody.error.includes('Too many checkout requests'));
  });

  // 8. Relevant security headers are present
  it('proves relevant baseline security headers are defined and evaluated', () => {
    const headers = getSecurityHeaders(false);
    const keys = headers.map((h) => h.key);

    assert.ok(keys.includes('Content-Security-Policy'));
    assert.ok(keys.includes('X-Content-Type-Options'));
    assert.ok(keys.includes('Referrer-Policy'));
    assert.ok(keys.includes('Permissions-Policy'));
    assert.ok(keys.includes('X-Frame-Options'));
  });
});
