/**
 * Callme Yoghurt — Load Testing Configuration (Phase 1.3A)
 *
 * Reads configuration from k6 environment variables (__ENV) with safe local fallbacks.
 * Invariants: Zero real credentials committed.
 */

export const CONFIG = {
  stagingUrl: (__ENV.STAGING_URL || 'http://127.0.0.1:3000').replace(/\/$/, ''),
  adminUrl: (__ENV.ADMIN_URL || __ENV.STAGING_URL || 'http://127.0.0.1:3000').replace(/\/$/, ''),
  erpInternalUrl: (__ENV.ERP_INTERNAL_URL || 'http://127.0.0.1:8000').replace(/\/$/, ''),
  testCustomerEmail: __ENV.TEST_CUSTOMER_EMAIL || 'loadtest.customer@callmeyoghurt.com',
  testAdminEmail: __ENV.TEST_ADMIN_EMAIL || 'admin@callmeyoghurt.com',
  testAdminPassword: __ENV.TEST_ADMIN_PASSWORD || 'SyntheticLoadTestPassword123!',
  testVariantId: __ENV.TEST_VARIANT_ID || '018f6c38-8c50-711e-b8d4-53a8be77e440',
  testIdempotencyKey: __ENV.TEST_IDEMPOTENCY_KEY || 'k6-stress-idemp-key-baseline',
  isFullRun: __ENV.FULL_RUN === 'true',
  defaultHeaders: {
    'Content-Type': 'application/json',
    'User-Agent': 'CallmeYoghurt-k6-LoadTester/1.0',
  },
};
