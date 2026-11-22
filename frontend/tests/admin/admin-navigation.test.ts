import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Admin Information Architecture & Route Isolation (Phase 1.7A)", () => {
  const REQUIRED_ADMIN_ROUTES = [
    { name: "Dashboard", href: "/admin", file: "src/app/admin/page.tsx" },
    { name: "Catalog", href: "/admin/catalog", file: "src/app/admin/catalog/page.tsx" },
    { name: "Inventory", href: "/admin/inventory", file: "src/app/admin/inventory/page.tsx" },
    { name: "Orders", href: "/admin/orders", file: "src/app/admin/orders/page.tsx" },
    { name: "Customers", href: "/admin/customers", file: "src/app/admin/customers/page.tsx" },
    { name: "Cold Chain", href: "/admin/cold-chain", file: "src/app/admin/cold-chain/page.tsx" },
    { name: "Reports", href: "/admin/reports", file: "src/app/admin/reports/page.tsx" },
    { name: "Security", href: "/admin/security", file: "src/app/admin/security/page.tsx" },
  ];

  it("proves all 8 dedicated admin module page files exist", () => {
    for (const route of REQUIRED_ADMIN_ROUTES) {
      const fullPath = path.resolve(process.cwd(), route.file);
      assert.ok(
        fs.existsSync(fullPath),
        `Required admin route file '${route.file}' must exist`
      );
    }
  });

  it("proves AdminShell defines all 8 real routes in sidebar navigation", () => {
    const shellPath = path.resolve(process.cwd(), "src/app/admin/AdminShell.tsx");
    assert.ok(fs.existsSync(shellPath), "AdminShell.tsx must exist");
    const content = fs.readFileSync(shellPath, "utf-8");

    for (const route of REQUIRED_ADMIN_ROUTES) {
      assert.ok(
        content.includes(`href: "${route.href}"`),
        `AdminShell must map sidebar item for '${route.name}' with href '${route.href}'`
      );
    }

    // Must not use old in-page anchor hash links
    const invalidAnchors = ["#catalog", "#inventory", "#orders", "#customers", "#cold-chain", "#reports", "#security"];
    for (const anchor of invalidAnchors) {
      assert.equal(
        content.includes(`"${anchor}"`),
        false,
        `AdminShell must NOT use in-page anchor link '${anchor}'`
      );
    }
  });

  it("proves fake operational metrics are NOT hardcoded in sidebar badges", () => {
    const shellPath = path.resolve(process.cwd(), "src/app/admin/AdminShell.tsx");
    const content = fs.readFileSync(shellPath, "utf-8");

    // Must not contain fake badge numbers in the sidebar
    assert.equal(
      content.includes('"520"'),
      false,
      "Sidebar must NOT contain fake hardcoded badge '520'"
    );
    assert.equal(
      content.includes('"4 Pending"'),
      false,
      "Sidebar must NOT contain fake hardcoded badge '4 Pending'"
    );
    assert.equal(
      content.includes('"2.4°C"'),
      false,
      "Sidebar must NOT contain fake hardcoded badge '2.4°C'"
    );
  });

  it("proves pathname-aware active state navigation logic is implemented in AdminShell", () => {
    const shellPath = path.resolve(process.cwd(), "src/app/admin/AdminShell.tsx");
    const content = fs.readFileSync(shellPath, "utf-8");

    assert.ok(
      content.includes("usePathname()"),
      "AdminShell must call usePathname() for active route highlighting"
    );
    assert.ok(
      content.includes('pathname === "/admin"'),
      "AdminShell must specifically match /admin for dashboard"
    );
    assert.ok(
      content.includes('aria-current={active ? "page" : undefined}'),
      "AdminShell must provide accessible aria-current attribute on active nav link"
    );
  });

  it("proves shared admin layout wraps admin pages and exempts /admin/login", () => {
    const layoutPath = path.resolve(process.cwd(), "src/app/admin/layout.tsx");
    assert.ok(fs.existsSync(layoutPath), "src/app/admin/layout.tsx must exist");
    const layoutContent = fs.readFileSync(layoutPath, "utf-8");

    assert.ok(
      layoutContent.includes("<AdminShell>"),
      "AdminRootLayout must wrap children in <AdminShell>"
    );

    const shellPath = path.resolve(process.cwd(), "src/app/admin/AdminShell.tsx");
    const shellContent = fs.readFileSync(shellPath, "utf-8");

    assert.ok(
      shellContent.includes('if (pathname === "/admin/login")'),
      "AdminShell must bypass the sidebar layout for /admin/login"
    );
  });

  it("proves Dashboard (/admin) is isolated to an executive overview and links to full modules", () => {
    const dashboardPath = path.resolve(process.cwd(), "src/app/admin/DashboardOverview.tsx");
    assert.ok(fs.existsSync(dashboardPath), "DashboardOverview.tsx must exist");
    const content = fs.readFileSync(dashboardPath, "utf-8");

    // Dashboard must contain links to full modules
    assert.ok(
      content.includes('href="/admin/orders"'),
      "Dashboard must link to full orders page (/admin/orders)"
    );
    assert.ok(
      content.includes('href="/admin/inventory"'),
      "Dashboard must link to full inventory page (/admin/inventory)"
    );
    assert.ok(
      content.includes('href="/admin/cold-chain"'),
      "Dashboard must link to cold-chain page (/admin/cold-chain)"
    );

    // Dashboard must include truthful sensor status
    assert.ok(
      content.includes("Belum ada sumber data sensor terhubung"),
      "Dashboard must display truthful sensor message without fake temperature"
    );
  });

  it("proves Catalog page (/admin/catalog) contains only 7 official flavors and 0 pisang", () => {
    const catalogPagePath = path.resolve(process.cwd(), "src/app/admin/catalog/page.tsx");
    const content = fs.readFileSync(catalogPagePath, "utf-8");

    const OFFICIAL_FLAVORS = ["Plain", "Stroberi", "Mangga", "Melon", "Anggur", "Leci", "Vanila"];
    for (const flavor of OFFICIAL_FLAVORS) {
      assert.ok(
        content.includes(flavor),
        `Catalog page must contain official flavor '${flavor}'`
      );
    }

    assert.equal(
      content.toLowerCase().includes("pisang"),
      false,
      "Catalog page must NEVER contain 'pisang'"
    );
  });

  it("proves Cold Chain page (/admin/cold-chain) displays truthful empty sensor state", () => {
    const coldChainPagePath = path.resolve(process.cwd(), "src/app/admin/cold-chain/page.tsx");
    const content = fs.readFileSync(coldChainPagePath, "utf-8");

    assert.ok(
      content.includes("Belum ada sumber data sensor cold-chain yang terhubung."),
      "Cold Chain page must state that no sensors are connected"
    );
    assert.ok(
      content.includes("Sensor Offline"),
      "Cold Chain placeholder zones must be explicitly marked as offline"
    );
  });

  it("proves Security page (/admin/security) enforces Zero-Trust and shows zero plaintext secrets", () => {
    const securityPagePath = path.resolve(process.cwd(), "src/app/admin/security/page.tsx");
    const content = fs.readFileSync(securityPagePath, "utf-8");

    assert.ok(content.includes("owner@callmeyoghurt.com"), "Security page must display owner email");
    assert.ok(content.includes("Argon2id"), "Security page must reference Argon2id hashing");
    assert.ok(content.includes("AES-256-GCM"), "Security page must reference AES-256-GCM encryption");
    assert.ok(content.includes("admin_audit_logs"), "Security page must reference admin_audit_logs");

    // Must not expose secret tokens
    assert.equal(content.includes("ERP_SERVICE_TOKEN"), false);
    assert.equal(content.includes("APP_KEY"), false);
    assert.equal(content.includes("DB_PASSWORD"), false);
  });
});
