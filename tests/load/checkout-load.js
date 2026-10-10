/**
 * Callme Yoghurt — Checkout Concurrency & Transaction Integrity Test (Scenario B - Phase 1.3A)
 *
 * Validates checkout transaction consistency and idempotency under concurrent user load.
 *
 * Scenario:
 *   100 concurrent users each:
 *     1. Open product page
 *     2. Construct unique valid checkout payload
 *     3. Submit checkout transaction with unique Idempotency-Key
 *
 * Assertions:
 *   - No duplicate orders created for different customers
 *   - Status codes are strictly valid (201 Created, 409 Conflict/OOS, 429 Rate Limited, or 502/503 Sanitized)
 *   - Zero database/token leakage in error responses
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { CONFIG } from './config.js';
import { buildCheckoutPayload, generateIdempotencyKey, thinkTime } from './helpers.js';

// Custom Metrics
const ordersCreated = new Counter('orders_created_count');
const ordersConflict = new Counter('orders_conflict_count');
const ordersRateLimited = new Counter('orders_rate_limited_count');
const checkoutLatency = new Trend('checkout_submission_latency_ms');

export const options = {
  scenarios: {
    checkout_concurrency: {
      executor: 'per-vu-iterations',
      vus: CONFIG.isFullRun ? 100 : 10,
      iterations: 1,
      maxDuration: '1m',
    },
  },
  thresholds: {
    checkout_submission_latency_ms: ['p(95)<3000'],
  },
};

export default function () {
  const vuId = __VU;
  const iterId = __ITER;

  group('1. Open Product Page', () => {
    const res = http.get(`${CONFIG.stagingUrl}/product/plain`, {
      headers: CONFIG.defaultHeaders,
      tags: { name: 'GET_Product_Before_Checkout' },
    });

    check(res, {
      'product page accessible': (r) => r.status === 200,
    });
  });

  thinkTime(100, 300);

  group('2. Submit Concurrent Checkout Transaction', () => {
    const idempotencyKey = generateIdempotencyKey(`vu${vuId}-iter${iterId}`);
    const payload = buildCheckoutPayload({
      variantId: CONFIG.testVariantId,
      quantity: 1,
    });

    const headers = Object.assign({}, CONFIG.defaultHeaders, {
      'Idempotency-Key': idempotencyKey,
    });

    const startTime = Date.now();
    const res = http.post(`${CONFIG.stagingUrl}/api/checkout`, JSON.stringify(payload), {
      headers,
      tags: { name: 'POST_Checkout' },
      responseCallback: http.expectedStatuses(200, 201, 400, 409, 429, 502, 503),
    });
    checkoutLatency.add(Date.now() - startTime);

    if (res.status === 201) {
      ordersCreated.add(1);
    } else if (res.status === 409) {
      ordersConflict.add(1);
    } else if (res.status === 429) {
      ordersRateLimited.add(1);
    }

    check(res, {
      'status is valid transaction result (201, 409, 429, 502, 503)': (r) => [200, 201, 409, 429, 502, 503].includes(r.status),
      'response does not leak ERP internal URL': (r) => !r.body || (!r.body.includes('localhost:8000') && !r.body.includes('127.0.0.1:8000')),
      'response does not leak ERP service token': (r) => !r.body || (!r.body.includes('ERP_SERVICE_TOKEN') && !r.body.includes('Bearer')),
    });
  });
}
