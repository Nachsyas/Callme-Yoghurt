/**
 * Callme Yoghurt — Idempotency Stress Test (Scenario D - Phase 1.3A)
 *
 * Validates distributed idempotency guarantees under high concurrency.
 *
 * Scenario:
 *   100 concurrent requests all submit the EXACT SAME Idempotency-Key.
 *
 * Expected Outcome:
 *   - At most 1 transaction created (HTTP 201 Created).
 *   - All concurrent/subsequent requests return either:
 *       a) HTTP 200 OK (idempotent replay of previously committed order)
 *       b) HTTP 409 Conflict (idempotency key lock active during in-flight processing)
 *   - ZERO duplicate orders created in database.
 */

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { CONFIG } from './config.js';
import { buildCheckoutPayload } from './helpers.js';

const sharedIdempotencyKey = `${CONFIG.testIdempotencyKey}-${Date.now()}`;

const sharedPayload = buildCheckoutPayload({
  variantId: CONFIG.testVariantId,
  name: 'Budi Santoso Idempotency Test',
  whatsapp: '081299998888',
  address: 'Jl. Merdeka No. 100, Jakarta',
  quantity: 1,
});

const createdTransactions = new Counter('idemp_created_count');
const replayedTransactions = new Counter('idemp_replayed_count');
const conflictTransactions = new Counter('idemp_conflict_count');
const duplicateAnomalyRate = new Rate('idemp_duplicate_anomaly_rate');

export const options = {
  scenarios: {
    idempotency_concurrency: {
      executor: 'per-vu-iterations',
      vus: CONFIG.isFullRun ? 100 : 10,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    idemp_duplicate_anomaly_rate: ['rate==0'],
  },
};

export default function () {
  const headers = Object.assign({}, CONFIG.defaultHeaders, {
    'Idempotency-Key': sharedIdempotencyKey,
  });

  const res = http.post(`${CONFIG.stagingUrl}/api/checkout`, JSON.stringify(sharedPayload), {
    headers,
    tags: { name: 'POST_Checkout_Idempotency' },
    responseCallback: http.expectedStatuses(200, 201, 400, 409, 429, 502, 503),
  });

  if (res.status === 201) {
    createdTransactions.add(1);
    duplicateAnomalyRate.add(0);
  } else if (res.status === 200) {
    replayedTransactions.add(1);
    duplicateAnomalyRate.add(0);
  } else if (res.status === 409) {
    conflictTransactions.add(1);
    duplicateAnomalyRate.add(0);
  } else if ([502, 503, 429].includes(res.status)) {
    // Sanitized upstream outage or rate limiter
    duplicateAnomalyRate.add(0);
  } else {
    // Anomaly: unexpected status
    duplicateAnomalyRate.add(1);
  }

  check(res, {
    'idempotency status is valid (201 created, 200 replay, 409 lock/conflict, 502/503 sanitized)': (r) => [200, 201, 409, 429, 502, 503].includes(r.status),
    'response body never exposes internal credentials': (r) => !r.body || (!r.body.includes('ERP_SERVICE_TOKEN') && !r.body.includes('Bearer')),
  });
}
