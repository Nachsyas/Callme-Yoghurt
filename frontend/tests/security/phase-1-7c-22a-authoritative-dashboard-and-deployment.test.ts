import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server.js";
import { resolveDeploymentRole, getDeploymentRole } from "../../src/lib/env-validator.ts";
import { middleware } from "../../src/middleware.ts";

describe("Phase 1.7C.22A — Authoritative Admin Dashboard & Deployment Role Hardening", () => {
  describe("Deployment Role Authority & Fail-Closed Invariants", () => {
    it("1. proves APP_DEPLOYMENT_ROLE is mandatory in production", () => {
      const prodEnvWithoutRole = {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_MODE: "admin",
      };

      const resolved = resolveDeploymentRole(prodEnvWithoutRole);
      assert.equal(resolved.isValid, false);
      assert.equal(resolved.role, null);
      assert.ok(resolved.error?.includes("APP_DEPLOYMENT_ROLE is mandatory in production"));
    });

    it("2. proves NEXT_PUBLIC_APP_MODE cannot serve as production authority", () => {
      const prodEnvWithPublicOnly = {
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_MODE: "storefront",
      };

      const resolved = resolveDeploymentRole(prodEnvWithPublicOnly);
      assert.equal(resolved.isValid, false);
      assert.equal(resolved.role, null);
    });

    it("3. proves contradictory role variables fail closed immediately", () => {
      const conflictingEnv = {
        NODE_ENV: "development",
        APP_DEPLOYMENT_ROLE: "admin",
        NEXT_PUBLIC_APP_MODE: "storefront",
      };

      const resolved = resolveDeploymentRole(conflictingEnv);
      assert.equal(resolved.isValid, false);
      assert.equal(resolved.role, null);
      assert.ok(resolved.error?.includes("contradict each other"));
    });

    it("4. proves valid production APP_DEPLOYMENT_ROLE resolves accurately", () => {
      const validAdminProd = {
        NODE_ENV: "production",
        APP_DEPLOYMENT_ROLE: "admin",
        NEXT_PUBLIC_APP_MODE: "admin",
      };

      const adminResolved = resolveDeploymentRole(validAdminProd);
      assert.equal(adminResolved.isValid, true);
      assert.equal(adminResolved.role, "admin");

      const validStorefrontProd = {
        NODE_ENV: "production",
        APP_DEPLOYMENT_ROLE: "storefront",
        NEXT_PUBLIC_APP_MODE: "storefront",
      };

      const sfResolved = resolveDeploymentRole(validStorefrontProd);
      assert.equal(sfResolved.isValid, true);
      assert.equal(sfResolved.role, "storefront");
    });

    it("5. proves middleware returns HTTP 503 fail-closed when deployment role is contradictory", async () => {
      const originalRole = process.env.APP_DEPLOYMENT_ROLE;
      const originalMode = process.env.NEXT_PUBLIC_APP_MODE;

      process.env.APP_DEPLOYMENT_ROLE = "admin";
      process.env.NEXT_PUBLIC_APP_MODE = "storefront";

      try {
        const req = new NextRequest("http://localhost:3000/api/admin/orders");
        const res = await middleware(req);
        assert.ok(res);
        assert.equal(res.status, 503);
      } finally {
        if (originalRole === undefined) delete process.env.APP_DEPLOYMENT_ROLE;
        else process.env.APP_DEPLOYMENT_ROLE = originalRole;

        if (originalMode === undefined) delete process.env.NEXT_PUBLIC_APP_MODE;
        else process.env.NEXT_PUBLIC_APP_MODE = originalMode;
      }
    });

    it("6. proves storefront deployment completely blocks admin API routes with HTTP 404", async () => {
      const originalRole = process.env.APP_DEPLOYMENT_ROLE;
      const originalMode = process.env.NEXT_PUBLIC_APP_MODE;

      process.env.APP_DEPLOYMENT_ROLE = "storefront";
      process.env.NEXT_PUBLIC_APP_MODE = "storefront";

      try {
        const req = new NextRequest("http://localhost:3000/api/admin/orders");
        const res = await middleware(req);
        assert.ok(res);
        assert.equal(res.status, 404);
      } finally {
        if (originalRole === undefined) delete process.env.APP_DEPLOYMENT_ROLE;
        else process.env.APP_DEPLOYMENT_ROLE = originalRole;

        if (originalMode === undefined) delete process.env.NEXT_PUBLIC_APP_MODE;
        else process.env.NEXT_PUBLIC_APP_MODE = originalMode;
      }
    });

    it("7. proves admin deployment blocks customer transaction mutations with HTTP 404", async () => {
      const originalRole = process.env.APP_DEPLOYMENT_ROLE;
      const originalMode = process.env.NEXT_PUBLIC_APP_MODE;

      process.env.APP_DEPLOYMENT_ROLE = "admin";
      process.env.NEXT_PUBLIC_APP_MODE = "admin";

      try {
        const req = new NextRequest("http://localhost:3000/api/checkout", { method: "POST" });
        const res = await middleware(req);
        assert.ok(res);
        assert.equal(res.status, 404);
      } finally {
        if (originalRole === undefined) delete process.env.APP_DEPLOYMENT_ROLE;
        else process.env.APP_DEPLOYMENT_ROLE = originalRole;

        if (originalMode === undefined) delete process.env.NEXT_PUBLIC_APP_MODE;
        else process.env.NEXT_PUBLIC_APP_MODE = originalMode;
      }
    });
  });

  describe("Admin Dashboard Data Integrity & Removal of Fabricated Metrics", () => {
    it("8. proves DashboardOverview.tsx contains zero hardcoded operational orders or KPI constants", () => {
      const dashboardPath = path.resolve(
        process.cwd(),
        "src/app/admin/DashboardOverview.tsx"
      );
      const code = fs.readFileSync(dashboardPath, "utf-8");

      // Verify removal of fake data structures
      assert.ok(!code.includes("RECENT_ORDERS_PREVIEW"), "Must not contain RECENT_ORDERS_PREVIEW");
      assert.ok(!code.includes("INVENTORY_ATTENTION_PREVIEW"), "Must not contain INVENTORY_ATTENTION_PREVIEW");

      // Verify removal of hardcoded numbers presented as operational reality
      assert.ok(!code.includes('"28 Pesanan"'), 'Must not contain hardcoded "28 Pesanan"');
      assert.ok(!code.includes('"+12% vs kemarin"'), 'Must not contain hardcoded "+12% vs kemarin"');
      assert.ok(!code.includes('"4 Perlu Packing"'), 'Must not contain hardcoded "4 Perlu Packing"');
      assert.ok(!code.includes('"7 SKUs Aktif"'), 'Must not contain hardcoded "7 SKUs Aktif"');
      assert.ok(!code.includes('"CMY-20260926-0001"'), 'Must not contain hardcoded preview order numbers');
      assert.ok(!code.includes('"LOT-20260915-01"'), 'Must not contain hardcoded preview lot codes');
    });

    it("9. proves DashboardOverview.tsx contains truthful ERP offline and empty states", () => {
      const dashboardPath = path.resolve(
        process.cwd(),
        "src/app/admin/DashboardOverview.tsx"
      );
      const code = fs.readFileSync(dashboardPath, "utf-8");

      assert.ok(code.includes("ERP Core Tidak Tersedia (Mode Aman)"), "Must contain truthful ERP offline alert banner");
      assert.ok(code.includes("Belum Ada Pesanan"), "Must contain genuine zero-data empty state");
      assert.ok(code.includes("Gross Order Value (GOV)"), "Must correctly label GOV instead of misleading realized revenue");
      assert.ok(code.includes("gross_order_value"), "Must read authoritative gross_order_value metric");
      assert.ok(code.includes("pending_payments_value"), "Must read authoritative pending_payments_value metric");
    });

    it("10. proves types.ts separates lifecycle, payment proof, and inventory reservation states", () => {
      const typesPath = path.resolve(process.cwd(), "src/lib/order/types.ts");
      const typesCode = fs.readFileSync(typesPath, "utf-8");

      assert.ok(typesCode.includes("'COMPLETED'") || typesCode.includes('"COMPLETED"'), "Must include COMPLETED lifecycle status");
      assert.ok(typesCode.includes("'PENDING'") || typesCode.includes('"PENDING"'), "Must include PENDING inventory reservation status");
      assert.ok(typesCode.includes("'UNAVAILABLE'") || typesCode.includes('"UNAVAILABLE"'), "Must include UNAVAILABLE inventory reservation status");
      assert.ok(typesCode.includes("gross_order_value?: number"), "Must include gross_order_value in OrderDashboardMetrics");
      assert.ok(typesCode.includes("pending_payments_value?: number"), "Must include pending_payments_value in OrderDashboardMetrics");
    });
  });
});
