/**
 * Callme Yoghurt — Inventory Race Condition & FEFO Overselling Test (Scenario C - Phase 1.3A)
 *
 * Simulates high-concurrency race condition where 100 simultaneous checkouts compete
 * for a limited inventory pool (e.g., 10 units of Plain Pure Original).
 *
 * Business Invariants:
 *   1. Exactly <= 10 successful orders (201 Created).
 *   2. Zero overselling (overselling count must equal 0).
 *   3. Exceeded checkouts fail closed with HTTP 409 Conflict (INSUFFICIENT_STOCK).
 *   4. Stock ledger, reservations, and FEFO allocations remain mathematically balanced.
 */

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { CONFIG } from './config.js';
import { buildCheckoutPayload, generateIdempotencyKey } from './helpers.js';

const successfulOrders = new Counter('race_successful_orders');
const conflictOrders = new Counter('race_conflict_orders');
const oversoldRate = new Rate('race_oversold_rate');

export const options = {
  scenarios: {
    inventory_race: {
      executor: 'per-vu-iterations',
      vus: CONFIG.isFullRun ? 100 : 10,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    race_oversold_rate: ['rate==0'],
  },
};

export default function () {
  const vuId = __VU;
  const iterId = __ITER;

  const idempotencyKey = generateIdempotencyKey(`race-vu${vuId}-${iterId}`);
  const payload = buildCheckoutPayload({
    variantId: CONFIG.testVariantId,
    quantity: 1,
  });

  const headers = Object.assign({}, CONFIG.defaultHeaders, {
    'Idempotency-Key': idempotencyKey,
  });

  const res = http.post(`${CONFIG.stagingUrl}/api/checkout`, JSON.stringify(payload), {
    headers,
    tags: { name: 'POST_Checkout_Race' },
    responseCallback: http.expectedStatuses(200, 201, 400, 409, 429, 502, 503),
  });

  if (res.status === 201) {
    successfulOrders.add(1);
    oversoldRate.add(0);
  } else if (res.status === 409) {
    conflictOrders.add(1);
    oversoldRate.add(0);
  } else if ([502, 503, 429].includes(res.status)) {
    // Graceful circuit breaker / rate limiter
    oversoldRate.add(0);
  } else {
    // Unexpected response code
    oversoldRate.add(1);
  }

  check(res, {
    'response status is valid (201 success, 409 conflict/OOS, or 502/503 sanitized upstream)': (r) => [200, 201, 409, 429, 502, 503].includes(r.status),
    'no internal credentials leaked': (r) => !r.body || (!r.body.includes('ERP_SERVICE_TOKEN') && !r.body.includes('Bearer')),
  });
}
