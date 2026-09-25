import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { hasPermission, requirePermission } from "../../src/lib/auth/permissions.ts";
import { createAdminSessionToken, type AdminSession } from "../../src/lib/auth/admin-session.ts";

describe("Admin Catalog Management & Authoritative Architecture (Phase 1.7C)", () => {
  it("proves catalog BFF API route handlers exist", () => {
    const routes = [
      "src/app/api/admin/catalog/products/route.ts",
      "src/app/api/admin/catalog/products/[id]/route.ts",
      "src/app/api/admin/catalog/variants/route.ts",
      "src/app/api/admin/catalog/variants/[id]/route.ts",
      "src/app/api/admin/catalog/variants/[id]/price/route.ts",
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

  it("proves catalog permissions are strictly enforced by RBAC", () => {
    // OWNER has full access
    assert.equal(hasPermission("OWNER", "admin:catalog:view"), true);
    assert.equal(hasPermission("OWNER", "admin:catalog:manage"), true);

    // ADMIN has operational catalog access
    assert.equal(hasPermission("ADMIN", "admin:catalog:view"), true);
    assert.equal(hasPermission("ADMIN", "admin:catalog:manage"), true);

    // Invalid or customer role fails closed
    assert.equal(hasPermission("CUSTOMER", "admin:catalog:view"), false);
    assert.equal(hasPermission("CUSTOMER", "admin:catalog:manage"), false);
    assert.equal(hasPermission("GUEST", "admin:catalog:manage"), false);
    assert.equal(hasPermission("", "admin:catalog:manage"), false);
  });

  it("proves requirePermission validates session actor context", () => {
    const ownerSession: AdminSession = {
      user: { id: "00000000-0000-0000-0000-000000000001", username: "owner", email: "owner@callme.com", role: "OWNER" },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      issuedAt: Math.floor(Date.now() / 1000),
    };

    const adminSession: AdminSession = {
      user: { id: "00000000-0000-0000-0000-000000000002", username: "admin", email: "admin@callme.com", role: "ADMIN" },
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      issuedAt: Math.floor(Date.now() / 1000),
    };

    assert.equal(requirePermission(ownerSession, "admin:catalog:manage"), true);
    assert.equal(requirePermission(adminSession, "admin:catalog:manage"), true);
    assert.equal(requirePermission(null, "admin:catalog:manage"), false);
  });

  it("proves Catalog page uses authoritative ERP API and zero fake catalog arrays", () => {
    const catalogPath = path.resolve(process.cwd(), "src/app/admin/catalog/page.tsx");
    const content = fs.readFileSync(catalogPath, "utf-8");

    // Must fetch from BFF
    assert.ok(
      content.includes('fetch("/api/admin/catalog/products"'),
      "Catalog page must fetch authoritative products from /api/admin/catalog/products"
    );

    // Must support authoritative CRUD operations
    assert.ok(content.includes("+ Tambah Produk"), "Catalog page must include '+ Tambah Produk'");
    assert.ok(content.includes("Tambah Varian"), "Catalog page must include 'Tambah Varian'");
    assert.ok(content.includes("Ubah Harga"), "Catalog page must include 'Ubah Harga'");
    assert.ok(content.includes("Nonaktifkan"), "Catalog page must include 'Nonaktifkan'");

    // Must NEVER include pisang
    assert.equal(content.toLowerCase().includes("pisang"), false, "Catalog page must NEVER contain 'pisang'");
  });

  it("proves create-variant form starts with blank price, inventory item, and UOM without assuming fixed defaults (Phase 1.7C.6)", () => {
    const catalogPath = path.resolve(process.cwd(), "src/app/admin/catalog/page.tsx");
    const content = fs.readFileSync(catalogPath, "utf-8");

    // Must start with blank price, inventory item, and UOM in initial state and open variant handler
    assert.ok(content.includes('price: "",'), "Variant create form must initialize price with an empty string");
    assert.ok(content.includes('inventory_item_id: "",'), "Variant create form must initialize inventory_item_id with an empty string");
    assert.ok(content.includes('net_content_uom_id: "",'), "Variant create form must initialize net_content_uom_id with an empty string");
    assert.ok(content.includes('net_content_quantity: "",'), "Variant create form must initialize net content with an empty string");

    // Must NOT contain hardcoded stale price defaults or auto-selected items
    assert.equal(content.includes('inventory_item_id: defaultItem'), false, "Must not auto-select inventoryItems[0]");
    assert.equal(content.includes('price: "15000"'), false, "Must not default price to 15000");
    assert.equal(content.includes('price: "16000"'), false, "Must not default price to 16000");
    assert.equal(content.includes('price: "30000"'), false, "Must not default price to 30000");
    assert.equal(content.includes('price: "55000"'), false, "Must not default price to 55000");
    assert.equal(content.includes('placeholder="15000"'), false, "Must not use placeholder 15000");

    // Must enforce explicit required input before submit
    assert.ok(
      content.includes("Item inventaris wajib dipilih"),
      "Must validate that inventory item is explicitly selected before submit"
    );
    assert.ok(
      content.includes("Satuan (UOM) wajib dipilih"),
      "Must validate that UOM is explicitly selected before submit"
    );
    assert.ok(
      content.includes("Harga awal harus berupa angka bulat positif lebih dari 0"),
      "Must validate that price is explicitly provided and greater than 0 before submit"
    );
  });
});
