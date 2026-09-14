import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../../src/app/api/checkout/route.ts';
import { getRateLimiter, DevMemoryRateLimiter } from '../../src/lib/security/rate-limit.ts';
import { getSecurityHeaders } from '../../src/lib/security/headers.ts';

describe('Checkout Route Security Baseline (Gate 0B, Gate 0E.1 & Gate 0E.2B Regression Suite)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const testSecretToken = 'super-secret-erp-internal-bearer-token-12345';
  const testErpUrl = 'http://erp-core-internal.local';
  const testIdempotencyKey = '018f6c38-8c50-711e-b8d4-53a8be77e43b';

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
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
          variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
          quantity: 2,
        },
      ],
      delivery_method: 'instant',
    };
  }

  function makeValidUpstreamSuccess() {
    return {
      order_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
      order_number: 'CY-20260914-01J7ABCDEF',
      status: 'CONFIRMED',
      total_amount: 50000,
    };
  }

  // 1. Internal ERP service credentials never appear in client responses
  it('proves internal ERP service credentials never appear in client responses', async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify(makeValidUpstreamSuccess()), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
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
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 503, 'Must fail closed with 503 when ERP token is missing');
    assert.equal(fetchCalled, false, 'Fetch must never be called with a hardcoded fallback token');
  });

  // 3. Mandatory Idempotency-Key header at edge boundary
  it('proves missing Idempotency-Key header returns HTTP 400 and does NOT call ERP', async () => {
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
    assert.equal(res.status, 400);
    assert.equal(fetchCalled, false, 'ERP fetch must NOT be called if Idempotency-Key is missing');
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, 'Missing or invalid Idempotency-Key header');
  });

  it('proves empty or whitespace-only Idempotency-Key header returns HTTP 400', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': '   ',
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    assert.equal(fetchCalled, false);
  });

  it('proves Idempotency-Key longer than 200 characters returns HTTP 400', async () => {
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    };

    const oversizedKey = 'a'.repeat(201);
    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': oversizedKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 400);
    assert.equal(fetchCalled, false);
  });

  it('proves valid Idempotency-Key is forwarded exactly to ERP upstream', async () => {
    let capturedIdempotencyHeader: string | null = null;
    globalThis.fetch = async (_url, init) => {
      capturedIdempotencyHeader = (init?.headers as Record<string, string>)?.['Idempotency-Key'] || null;
      return new Response(JSON.stringify(makeValidUpstreamSuccess()), { status: 201 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 201);
    assert.equal(capturedIdempotencyHeader, testIdempotencyKey);
  });

  // 4. Malformed checkout payload is rejected
  it('proves malformed checkout payloads are rejected with HTTP 400', async () => {
    const validUuid = '018f6c38-8c50-711e-b8d4-53a8be77e43a';
    const malformedInputs = [
      {}, // Empty body
      { customer: null, items: [] },
      { customer: { name: '', whatsapp: '081', address: 'addr' }, items: [{ variant_id: validUuid, quantity: 1 }], delivery_method: 'instant' },
      { customer: { name: 'A', whatsapp: '', address: 'addr' }, items: [{ variant_id: validUuid, quantity: 1 }], delivery_method: 'instant' },
      { customer: { name: 'A', whatsapp: '081', address: '' }, items: [{ variant_id: validUuid, quantity: 1 }], delivery_method: 'instant' },
      { customer: { name: 'A'.repeat(256), whatsapp: '081', address: 'addr' }, items: [{ variant_id: validUuid, quantity: 1 }], delivery_method: 'instant' }, // Name > 255
      { customer: { name: 'A', whatsapp: '0'.repeat(51), address: 'addr' }, items: [{ variant_id: validUuid, quantity: 1 }], delivery_method: 'instant' }, // WhatsApp > 50
      { customer: { name: 'A', whatsapp: '081', address: 'addr'.repeat(251) }, items: [{ variant_id: validUuid, quantity: 1 }], delivery_method: 'instant' }, // Address > 1000
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [], delivery_method: 'instant' }, // Empty items
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [{ variant_id: 'not-a-uuid', quantity: 1 }], delivery_method: 'instant' }, // Invalid UUID
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [{ variant_id: validUuid, quantity: 0 }], delivery_method: 'instant' }, // 0 qty
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [{ variant_id: validUuid, quantity: -5 }], delivery_method: 'instant' }, // Negative qty
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [{ variant_id: validUuid, quantity: 101 }], delivery_method: 'instant' }, // Qty > 100
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [{ variant_id: validUuid, quantity: 1.5 }], delivery_method: 'instant' }, // Non-integer
      { customer: { name: 'A', whatsapp: '081', address: 'addr' }, items: [{ variant_id: validUuid, quantity: 1 }], delivery_method: 'teleport' }, // Invalid delivery method
      // 51 items exceeds limit of 50
      {
        customer: { name: 'A', whatsapp: '081', address: 'addr' },
        items: Array.from({ length: 51 }, () => ({ variant_id: validUuid, quantity: 1 })),
        delivery_method: 'instant',
      },
    ];

    for (const input of malformedInputs) {
      const limiter = getRateLimiter();
      if (limiter instanceof DevMemoryRateLimiter) {
        limiter.clear();
      }

      const req = new Request('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': testIdempotencyKey,
        },
        body: JSON.stringify(input),
      });

      const res = await POST(req);
      assert.equal(
        res.status,
        400,
        `Expected HTTP 400 for input: ${JSON.stringify(input).slice(0, 100)}`,
      );

      const body = (await res.json()) as { error: string };
      assert.equal(body.error, 'Invalid checkout payload');
    }
  });

  // 5. Client-injected prices/roles stripped before forwarding
  it('proves client-injected pricing, discounts, and roles are stripped before ERP forwarding', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = async (_url, init) => {
      capturedBody = JSON.parse(init?.body as string) as Record<string, unknown>;
      return new Response(JSON.stringify(makeValidUpstreamSuccess()), { status: 201 });
    };

    const maliciousPayload = {
      customer: {
        name: 'Attacker',
        whatsapp: '081234567890',
        address: 'Jl. Hacking No. 1',
        role: 'SUPERADMIN',
        tier: 'VIP_FREE',
      },
      items: [
        {
          variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
          quantity: 1,
          price: 1, // Attempting 1 IDR exploit
          unit_price: 1,
          subtotal: 1,
          discount: 99999,
          stock: 999,
          lot: 'LOT-OVERRIDE',
        },
      ],
      delivery_method: 'instant',
      total_price: 1,
      currency: 'USD',
      discount_code: 'FREE100',
      shipping_cost: 0,
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(maliciousPayload),
    });

    const res = await POST(req);
    assert.equal(res.status, 201);
    assert.ok(capturedBody);

    const forwarded = capturedBody as {
      customer: Record<string, unknown>;
      items: Array<Record<string, unknown>>;
      total_price?: unknown;
      currency?: unknown;
      discount_code?: unknown;
      shipping_cost?: unknown;
    };

    assert.equal(forwarded.customer.role, undefined);
    assert.equal(forwarded.customer.tier, undefined);
    assert.equal(forwarded.total_price, undefined);
    assert.equal(forwarded.currency, undefined);
    assert.equal(forwarded.discount_code, undefined);
    assert.equal(forwarded.shipping_cost, undefined);

    const forwardedItem = forwarded.items[0];
    assert.equal(forwardedItem.price, undefined);
    assert.equal(forwardedItem.unit_price, undefined);
    assert.equal(forwardedItem.subtotal, undefined);
    assert.equal(forwardedItem.discount, undefined);
    assert.equal(forwardedItem.stock, undefined);
    assert.equal(forwardedItem.lot, undefined);
    assert.equal(forwardedItem.variant_id, '018f6c38-8c50-711e-b8d4-53a8be77e43a');
    assert.equal(forwardedItem.quantity, 1);
  });

  // 6. Missing ERP internal URL fails closed with 503
  it('proves missing ERP internal URL fails closed with HTTP 503', async () => {
    delete process.env.ERP_INTERNAL_URL;

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, 'Checkout service is temporarily unavailable');
  });

  // 7. Status mapping: 201 -> 201, 200 -> 200, 409 -> 409, 422 -> 422, 503 -> 503, 500 -> 502
  it('proves new committed order 201 maps to BFF 201', async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify(makeValidUpstreamSuccess()), { status: 201 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 201);
    const json = (await res.json()) as { success: boolean; data: { order_id: string } };
    assert.equal(json.success, true);
    assert.equal(json.data.order_id, '018f6c38-8c50-711e-b8d4-53a8be77e440');
  });

  it('proves idempotent replay 200 maps to BFF 200', async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify(makeValidUpstreamSuccess()), { status: 200 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 200);
    const json = (await res.json()) as { success: boolean; data: { order_id: string } };
    assert.equal(json.success, true);
  });

  it('proves upstream ERP 409 maps to sanitized 409 without internal trace', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          error: 'InsufficientInventoryException: Lot lot-123 has only 1 available',
          internal_state: 'inventory_conflict',
        }),
        { status: 409 },
      );
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 409);
    const body = (await res.json()) as { error: string; request_id: string };
    assert.equal(body.error, 'Checkout conflict or inventory unavailable');
    assert.ok(body.request_id);
  });

  it('proves upstream ERP 422 maps to sanitized 422', async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ message: 'Validation failed' }), { status: 422 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 422);
    const body = (await res.json()) as { error: string; request_id: string };
    assert.equal(body.error, 'Invalid checkout data');
    assert.ok(body.request_id);
  });

  it('proves upstream ERP 503 maps to sanitized 503', async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ message: 'Fulfillment warehouse down' }), { status: 503 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 503);
    const body = (await res.json()) as { error: string; request_id: string };
    assert.equal(body.error, 'Checkout service is temporarily unavailable');
    assert.ok(body.request_id);
  });

  it('proves upstream error traces and internal database URLs are never leaked to client (500 -> 502)', async () => {
    globalThis.fetch = async () => {
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
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
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

  // 8. Success contract validation & field stripping
  it('proves upstream success responses are strictly filtered and internal fields are never exposed', async () => {
    globalThis.fetch = async () => {
      const sensitiveUpstreamSuccess = {
        order_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
        order_number: 'CY-20260914-01J7ABCDEF',
        status: 'CONFIRMED',
        total_amount: 100000,
        internal_secret: 'DO_NOT_EXPOSE_INTERNAL_KEY',
        database_url: 'postgres://callme_admin:secret@internal-db:5432/callme_db',
        debug: {
          stack: 'trace_info_here',
          execution_time_ms: 42,
        },
        internal_node: 'worker-node-alpha-01',
      };

      return new Response(JSON.stringify(sensitiveUpstreamSuccess), { status: 201 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 201);

    const bodyText = await res.text();
    assert.ok(!bodyText.includes('DO_NOT_EXPOSE_INTERNAL_KEY'), 'Must never leak internal_secret');
    assert.ok(!bodyText.includes('database_url'), 'Must never leak database_url key');
    assert.ok(!bodyText.includes('postgres://'), 'Must never leak database connection URI');
    assert.ok(!bodyText.includes('trace_info_here'), 'Must never leak debug stack trace');
    assert.ok(!bodyText.includes('worker-node-alpha-01'), 'Must never leak internal node info');

    const json = JSON.parse(bodyText) as {
      success: boolean;
      request_id: string;
      data: Record<string, unknown>;
    };

    assert.equal(json.success, true);
    assert.equal(json.data.order_id, '018f6c38-8c50-711e-b8d4-53a8be77e440');
    assert.equal(json.data.order_number, 'CY-20260914-01J7ABCDEF');
    assert.equal(json.data.status, 'CONFIRMED');
    assert.equal(json.data.total_amount, 100000);
    assert.equal(json.data.request_id, json.request_id);
    assert.equal(json.data.internal_secret, undefined);
    assert.equal(json.data.database_url, undefined);
    assert.equal(json.data.debug, undefined);
  });

  // 9. Upstream contract violations fail closed with 502
  it('proves missing order_id in 201 response fails closed with 502', async () => {
    globalThis.fetch = async () => {
      const invalid = {
        order_number: 'CY-20260914-01J7ABCDEF',
        status: 'CONFIRMED',
        total_amount: 50000,
      };
      return new Response(JSON.stringify(invalid), { status: 201 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 502);
  });

  it('proves malformed order_id (non-UUID) in 201 response fails closed with 502', async () => {
    globalThis.fetch = async () => {
      const invalid = {
        order_id: 'not-a-valid-uuid',
        order_number: 'CY-20260914-01J7ABCDEF',
        status: 'CONFIRMED',
        total_amount: 50000,
      };
      return new Response(JSON.stringify(invalid), { status: 201 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 502);
  });

  it('proves missing order_number in 201 response fails closed with 502', async () => {
    globalThis.fetch = async () => {
      const invalid = {
        order_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
        status: 'CONFIRMED',
        total_amount: 50000,
      };
      return new Response(JSON.stringify(invalid), { status: 201 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 502);
  });

  it('proves status other than CONFIRMED in 201 response fails closed with 502', async () => {
    globalThis.fetch = async () => {
      const invalid = {
        order_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
        order_number: 'CY-20260914-01J7ABCDEF',
        status: 'PENDING',
        total_amount: 50000,
      };
      return new Response(JSON.stringify(invalid), { status: 201 });
    };

    const req = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': testIdempotencyKey,
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const res = await POST(req);
    assert.equal(res.status, 502);
  });

  it('proves missing, negative, or non-integer total_amount in 201 response fails closed with 502', async () => {
    const invalidAmounts = [undefined, -100, 10.5, '50000', NaN, Infinity];

    for (const amt of invalidAmounts) {
      const limiter = getRateLimiter();
      if (limiter instanceof DevMemoryRateLimiter) {
        limiter.clear();
      }

      globalThis.fetch = async () => {
        const invalid = {
          order_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
          order_number: 'CY-20260914-01J7ABCDEF',
          status: 'CONFIRMED',
          total_amount: amt,
        };
        return new Response(JSON.stringify(invalid), { status: 201 });
      };

      const req = new Request('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': testIdempotencyKey,
        },
        body: JSON.stringify(makeValidPayload()),
      });

      const res = await POST(req);
      assert.equal(res.status, 502, `Expected 502 for invalid amount: ${amt}`);
    }
  });

  // 10. Rate limiting behavior
  it('proves rate limiting boundary enforces HTTP 429 when threshold is exceeded', async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify(makeValidUpstreamSuccess()), { status: 201 });
    };

    for (let i = 1; i <= 5; i++) {
      const req = new Request('http://localhost:3000/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `key-${i}`,
        },
        body: JSON.stringify(makeValidPayload()),
      });

      const res = await POST(req);
      assert.equal(res.status, 201, `Request ${i} of 5 should succeed`);
      assert.equal(res.headers.get('x-ratelimit-limit'), '5');
      assert.equal(res.headers.get('x-ratelimit-remaining'), String(5 - i));
    }

    const blockedReq = new Request('http://localhost:3000/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'key-6',
      },
      body: JSON.stringify(makeValidPayload()),
    });

    const blockedRes = await POST(blockedReq);
    assert.equal(blockedRes.status, 429, '6th request must be rejected with 429');
    assert.ok(blockedRes.headers.get('retry-after'), 'Retry-After header must be present on 429');

    const blockedBody = (await blockedRes.json()) as { error: string };
    assert.ok(blockedBody.error.includes('Too many checkout requests'));
  });

  // 11. Security headers
  it('proves relevant baseline security headers are defined and evaluated', () => {
    const headers = getSecurityHeaders({ isProduction: false });
    const keys = headers.map((h) => h.key);

    assert.ok(keys.includes('Content-Security-Policy'));
    assert.ok(keys.includes('X-Content-Type-Options'));
    assert.ok(keys.includes('Referrer-Policy'));
    assert.ok(keys.includes('Permissions-Policy'));
    assert.ok(keys.includes('X-Frame-Options'));
  });
});
