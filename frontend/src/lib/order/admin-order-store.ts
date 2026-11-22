/**
 * @deprecated TEST-ONLY FIXTURE ISOLATED TO: tests/fixtures/admin-order-store.ts
 *
 * PHASE 1.7C.22A.2 — ADMIN MOCK AUTHORITY ISOLATION GATE
 *
 * This file is completely forbidden as an operational or production authority.
 * Real order, inventory, reservation, and payment operations must be queried
 * and commanded through the authoritative PostgreSQL / Laravel ERP API.
 *
 * All unit tests requiring synthetic mocks must import from:
 * `tests/fixtures/admin-order-store.ts`
 */

export const adminOrderStore = new Proxy({} as never, {
  get(_target, prop) {
    throw new Error(
      `SECURITY VIOLATION: Accessing adminOrderStore.${String(prop)} from src/lib is forbidden. ` +
      `Mock order store cannot be used as operational authority. ` +
      `Test fixtures must import from tests/fixtures/admin-order-store.ts.`
    );
  },
});
