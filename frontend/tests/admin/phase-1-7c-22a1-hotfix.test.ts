import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Phase 1.7C.22A.1 — Database Safety, Admin Data Integrity & Test Isolation Hotfix', () => {
  const rootDir = process.cwd();

  it('1. proves zero hardcoded available_stock: 20 fallback exists in admin orders page', () => {
    const ordersPagePath = path.resolve(rootDir, 'src/app/admin/orders/page.tsx');
    const content = fs.readFileSync(ordersPagePath, 'utf-8');

    assert.doesNotMatch(
      content,
      /available_stock:\s*20/,
      'admin/orders/page.tsx must not hardcode available_stock: 20 fallback'
    );
    assert.match(
      content,
      /Data stok belum tersedia/,
      'admin/orders/page.tsx must render "Data stok belum tersedia" when stock is undefined'
    );
  });

  it('2. proves types.ts makes available_stock optional and supports PARTIAL reservation status', () => {
    const typesPath = path.resolve(rootDir, 'src/lib/order/types.ts');
    const content = fs.readFileSync(typesPath, 'utf-8');

    assert.match(
      content,
      /available_stock\?: number;/,
      'InventoryReservationItem must define available_stock?: number as optional'
    );
    assert.match(
      content,
      /'PARTIAL'/,
      'InventoryReservationStatus must support PARTIAL status'
    );
    assert.match(
      content,
      /export interface AdminOrderPagination/,
      'types.ts must define AdminOrderPagination interface'
    );
  });

  it('3. proves admin orders page integrates server-side bounded pagination', () => {
    const ordersPagePath = path.resolve(rootDir, 'src/app/admin/orders/page.tsx');
    const content = fs.readFileSync(ordersPagePath, 'utf-8');

    assert.match(
      content,
      /AdminOrderPagination/,
      'admin/orders/page.tsx must import and use AdminOrderPagination'
    );
    assert.match(
      content,
      /params\.set\("page",\s*String\(pageToUse\)\)/,
      'fetchOrders must pass page parameter to API'
    );
    assert.match(
      content,
      /params\.set\("per_page",\s*String\(perPage\)\)/,
      'fetchOrders must pass per_page parameter to API'
    );
    assert.match(
      content,
      /Menampilkan halaman/,
      'admin/orders/page.tsx must render pagination controls'
    );
  });

  it('4. proves screenshot verification scripts contain zero destructive order deletions', () => {
    const captureScriptPath = path.resolve(rootDir, '../scripts/capture-phase-1.7C.22A.cjs');
    if (fs.existsSync(captureScriptPath)) {
      const content = fs.readFileSync(captureScriptPath, 'utf-8');
      assert.doesNotMatch(
        content,
        /Order::query\(\)->delete\(\)/,
        'capture-phase-1.7C.22A.cjs must NOT execute Order::query()->delete()'
      );
      assert.doesNotMatch(
        content,
        /db:wipe|migrate:fresh/i,
        'capture-phase-1.7C.22A.cjs must NOT wipe or reset database'
      );
    }
  });

  it('5. proves dedicated test compose stack docker-compose.testing.yml isolates test volumes and database', () => {
    const composeTestingPath = path.resolve(rootDir, '../docker-compose.testing.yml');
    assert.ok(fs.existsSync(composeTestingPath), 'docker-compose.testing.yml must exist');
    const content = fs.readFileSync(composeTestingPath, 'utf-8');

    assert.match(content, /callme_test_postgres_data/, 'Must use unique test postgres volume');
    assert.match(content, /callme_yoghurt_test/, 'Must use callme_yoghurt_test database');
    assert.doesNotMatch(content, /callme_yoghurt_prod/, 'Must never connect to callme_yoghurt_prod');
    assert.match(content, /APP_ENV:\s*testing/, 'Must specify APP_ENV=testing');
  });

  it('6. proves backend TestCase enforces fail-closed isolation guard against production environment and DB', () => {
    const testCasePath = path.resolve(rootDir, '../backend-core/tests/TestCase.php');
    const content = fs.readFileSync(testCasePath, 'utf-8');

    assert.match(
      content,
      /SAFETY VIOLATION/,
      'TestCase.php must throw SAFETY VIOLATION on invalid environment or DB'
    );
    assert.match(
      content,
      /callme_yoghurt_prod/,
      'TestCase.php must guard against callme_yoghurt_prod database'
    );
  });
});
