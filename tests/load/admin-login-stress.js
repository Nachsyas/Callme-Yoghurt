/**
 * Callme Yoghurt — Admin Authentication Stress & Rate Limiting Test (Scenario E - Phase 1.3A)
 *
 * Simulates high-frequency credential stuffing / brute-force attack on admin authentication.
 *
 * Scenario:
 *   Submits failed login attempts with invalid credentials.
 *   Full Run: 1000 attempts (20 VUs x 50 iterations).
 *   Smoke Run: 25 attempts (5 VUs x 5 iterations).
 *
 * Expected Outcome:
 *   1. Initial failed attempts return HTTP 401 Unauthorized ("Invalid credentials").
 *   2. Burst attempts trigger HTTP 429 Too Many Requests via distributed rate limiter.
 *   3. Zero information disclosure (no stack traces, database schema, or internal URLs).
 *   4. Zero authentication bypass (HTTP 200 must NEVER occur for invalid credentials).
 */

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { CONFIG } from './config.js';

const unauthorizedCount = new Counter('auth_unauthorized_count');
const rateLimitedCount = new Counter('auth_rate_limited_count');
const bypassAnomalyRate = new Rate('auth_bypass_anomaly_rate');

export const options = {
  scenarios: {
    admin_login_stress: {
      executor: 'per-vu-iterations',
      vus: CONFIG.isFullRun ? 20 : 5,
      iterations: CONFIG.isFullRun ? 50 : 5,
      maxDuration: '1m',
    },
  },
  thresholds: {
    auth_bypass_anomaly_rate: ['rate==0'],
  },
};

export default function () {
  const invalidPayload = JSON.stringify({
    email: CONFIG.testAdminEmail,
    password: `WrongPasswordAttempt-${Date.now()}-${__VU}-${__ITER}`,
  });

  const res = http.post(`${CONFIG.adminUrl}/api/admin/login`, invalidPayload, {
    headers: CONFIG.defaultHeaders,
    tags: { name: 'POST_Admin_Login_Stress' },
    responseCallback: http.expectedStatuses(200, 400, 401, 429, 502, 503),
  });

  if (res.status === 401) {
    unauthorizedCount.add(1);
    bypassAnomalyRate.add(0);
  } else if (res.status === 429) {
    rateLimitedCount.add(1);
    bypassAnomalyRate.add(0);
  } else if ([502, 503].includes(res.status)) {
    // Upstream ERP offline or circuit breaker
    bypassAnomalyRate.add(0);
  } else if (res.status === 200) {
    // CRITICAL SECURITY VIOLATION: invalid credentials bypassed authentication!
    bypassAnomalyRate.add(1);
  } else {
    // Unexpected response code
    bypassAnomalyRate.add(0);
  }

  check(res, {
    'authentication bypass rejected (status is NOT 200)': (r) => r.status !== 200,
    'status is expected security response (401, 429, or 502/503)': (r) => [401, 429, 502, 503].includes(r.status),
    'response does not leak internal ERP URL': (r) => !r.body || (!r.body.includes('localhost:8000') && !r.body.includes('127.0.0.1:8000')),
    'response does not leak admin session secret': (r) => !r.body || !r.body.includes('ADMIN_SESSION_SECRET'),
  });
}
