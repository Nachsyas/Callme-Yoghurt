/**
 * Callme Yoghurt — Customer Browsing Load Test (Scenario A - Phase 1.3A)
 *
 * Simulates high-concurrency customer browsing on storefront landing, product, and catalog APIs.
 *
 * Execution Stages (Full Run):
 *   Stage 1: Ramp 0 -> 50 users (2m)
 *   Stage 2: Ramp 50 -> 200 users (5m)
 *   Stage 3: Ramp 200 -> 500 users (5m)
 *
 * Thresholds:
 *   - http_req_failed: < 1%
 *   - p95 latency: < 1000ms
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { CONFIG } from './config.js';
import { thinkTime } from './helpers.js';

// Custom Metrics
const browsingSuccessRate = new Rate('browsing_success_rate');
const catalogPageLatency = new Trend('catalog_page_latency_ms');

export const options = {
  stages: CONFIG.isFullRun
    ? [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 200 },
        { duration: '5m', target: 500 },
        { duration: '1m', target: 0 },
      ]
    : [
        { duration: '2s', target: 5 },
        { duration: '3s', target: 15 },
        { duration: '2s', target: 0 },
      ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    browsing_success_rate: ['rate>0.99'],
  },
};

export default function () {
  group('1. Customer Storefront Landing Page', () => {
    const res = http.get(`${CONFIG.stagingUrl}/`, {
      headers: CONFIG.defaultHeaders,
      tags: { name: 'GET_Home' },
    });

    const success = check(res, {
      'homepage status is 200': (r) => r.status === 200,
      'homepage contains brand': (r) => r.body && r.body.includes('Callme Yoghurt'),
    });

    browsingSuccessRate.add(success);
    catalogPageLatency.add(res.timings.duration);
  });

  thinkTime(100, 300);

  group('2. Customer Product Detail Page', () => {
    const res = http.get(`${CONFIG.stagingUrl}/product/plain`, {
      headers: CONFIG.defaultHeaders,
      tags: { name: 'GET_Product' },
    });

    const success = check(res, {
      'product page status is 200': (r) => r.status === 200,
      'product page contains Plain flavor': (r) => r.body && r.body.includes('Plain Pure Original'),
    });

    browsingSuccessRate.add(success);
    catalogPageLatency.add(res.timings.duration);
  });

  thinkTime(100, 300);

  group('3. Authoritative Catalog BFF API', () => {
    const res = http.get(`${CONFIG.stagingUrl}/api/catalog`, {
      headers: CONFIG.defaultHeaders,
      tags: { name: 'GET_Catalog_API' },
      responseCallback: http.expectedStatuses(200, 502, 503),
    });

    // BFF returns 200 when ERP is connected, or sanitized 502/503 when ERP is offline
    const success = check(res, {
      'catalog response is valid HTTP status (200, 502, 503)': (r) => [200, 502, 503].includes(r.status),
      'catalog response does not leak internal tokens': (r) => !r.body || (!r.body.includes('ERP_SERVICE_TOKEN') && !r.body.includes('Bearer')),
    });

    browsingSuccessRate.add(success);
    catalogPageLatency.add(res.timings.duration);
  });

  thinkTime(200, 500);
}
