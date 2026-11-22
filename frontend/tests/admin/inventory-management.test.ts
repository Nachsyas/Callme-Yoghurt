import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { hasPermission, requirePermission } from "../../src/lib/auth/permissions.ts";
import type { AdminSession } from "../../src/lib/auth/admin-session.ts";

describe("Admin Inventory Management & Append-Only Ledger (Phase 1.7C)", () => {
  it("proves inventory BFF API route handlers exist", () => {
    const routes = [
      "src/app/api/admin/inventory/items/route.ts",
      "src/app/api/admin/inventory/items/[id]/route.ts",
      "src/app/api/admin/inventory/lots/route.ts",
      "src/app/api/admin/inventory/receipts/route.ts",
      "src/app/api/admin/inventory/adjustments/route.ts",
      "src/app/api/admin/inventory/ledger/route.ts",
      "src/app/api/admin/inventory/meta/route.ts",
    ];

    for (const route of routes) {
      const fullPath = path.resolve(process.cwd(), route);
      assert.ok(fs.existsSync(fullPath), `Required BFF route '${route}' must exist`);
      const content = fs.readFileSync(fullPath, "utf-8");
      assert.ok(
        content.includes("forwardToErpAdmin"),
        `BFF route '${route}' must use forwardToErpAdmin helper`
      );
    }
  });

  it("proves inventory permissions are strictly enforced by RBAC", () => {
    // OWNER has full access
    assert.equal(hasPermission("OWNER", "admin:inventory:view"), true);
    assert.equal(hasPermission("OWNER", "admin:inventory:manage"), true);

    // ADMIN has operational inventory access
    assert.equal(hasPermission("ADMIN", "admin:inventory:view"), true);
    assert.equal(hasPermission("ADMIN", "admin:inventory:manage"), true);

    // Invalid role fails closed
    assert.equal(hasPermission("CUSTOMER", "admin:inventory:manage"), false);
    assert.equal(hasPermission("GUEST", "admin:inventory:manage"), false);
    assert.equal(hasPermission("WAREHOUSE_STAFF", "admin:inventory:manage"), false);
  });

  it("proves Inventory page uses authoritative stock and does not calculate running balance in React", () => {
    const invPath = path.resolve(process.cwd(), "src/app/admin/inventory/page.tsx");
    const content = fs.readFileSync(invPath, "utf-8");

    // Must fetch authoritative stock from BFF
    assert.ok(
      content.includes('fetch("/api/admin/inventory/items"'),
      "Inventory page must fetch from /api/admin/inventory/items"
    );
    assert.ok(
      content.includes('fetch("/api/admin/inventory/lots"'),
      "Inventory page must fetch from /api/admin/inventory/lots"
    );
    assert.ok(
      content.includes('fetch("/api/admin/inventory/ledger'),
      "Inventory page must fetch from /api/admin/inventory/ledger"
    );

    // Operational actions exist
    assert.ok(content.includes("Terima Stok"), "Must include 'Terima Stok'");
    assert.ok(content.includes("Penyesuaian Stok"), "Must include 'Penyesuaian Stok'");
    assert.ok(content.includes("+ Tambah Item"), "Must include '+ Tambah Item'");

    // Uses authoritative current stock terminology
    assert.ok(content.includes("Authoritative On Hand"), "Must display Authoritative On Hand");
    assert.ok(content.includes("Authoritative Available"), "Must display Authoritative Available");

    // Must not calculate balance in client
    assert.equal(
      content.includes("runningBalance"),
      false,
      "React UI must NOT compute authoritative running balance"
    );
  });
});
