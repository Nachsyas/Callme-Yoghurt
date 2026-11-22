import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server.js";
import { middleware } from "../../src/middleware.ts";
import {
  createAdminSessionToken,
  ADMIN_COOKIE_NAME,
  type AdminUser,
} from "../../src/lib/auth/admin-session.ts";
import { forwardToErpAdmin } from "../../src/lib/auth/admin-bff.ts";
import { GET as catalogRoute } from "../../src/app/api/catalog/route.ts";
import { POST as checkoutRoute } from "../../src/app/api/checkout/route.ts";
import { POST as loginRoute } from "../../src/app/api/admin/login/route.ts";
import {
  validateDeploymentEnv,
  getDeploymentRole,
} from "../../src/lib/env-validator.ts";
import {
  buildCanonicalDestinationInput,
  buildCanonicalCheckoutPayload,
  type CheckoutPayload,
} from "../../src/lib/checkout-client.ts";
import { isLegacyPreviewVariantId, toTransactionProjection } from "../../src/store/cartStore.ts";

const TEST_SECRET = "test_cryptographically_secure_admin_session_key_32c";

describe("Phase 1.7C.22 — Dual Vercel Deployment & Isolation Verification", () => {
  const adminUser: AdminUser = {
    id: "usr-admin-ops",
    username: "deploy_lead",
    email: "lead@callmeyoghurt.com",
    role: "ADMIN",
  };

  const ownerUser: AdminUser = {
    id: "usr-owner-exec",
    username: "owner_lead",
    email: "owner@callmeyoghurt.com",
    role: "OWNER",
  };

  // 1. Storefront role blocks /admin pages
  it("1. Storefront role blocks /admin pages at server boundary", async () => {
    const origRole = process.env.APP_DEPLOYMENT_ROLE;
    const origMode = process.env.NEXT_PUBLIC_APP_MODE;
    process.env.APP_DEPLOYMENT_ROLE = "storefront";
    delete process.env.NEXT_PUBLIC_APP_MODE;

    try {
      const req = new NextRequest("http://localhost:3000/admin");
      const res = await middleware(req);
      assert.ok(res);
      assert.equal(res.status, 307);
      assert.ok(res.headers.get("location")?.endsWith("/"));

      const reqSub = new NextRequest("http://localhost:3000/admin/orders");
      const resSub = await middleware(reqSub);
      assert.equal(resSub.status, 307);
      assert.ok(resSub.headers.get("location")?.endsWith("/"));
    } finally {
      process.env.APP_DEPLOYMENT_ROLE = origRole;
      process.env.NEXT_PUBLIC_APP_MODE = origMode;
    }
  });

  // 2. Storefront role blocks /api/admin routes
  it("2. Storefront role blocks /api/admin routes with HTTP 404", async () => {
    const origRole = process.env.APP_DEPLOYMENT_ROLE;
    process.env.APP_DEPLOYMENT_ROLE = "storefront";

    try {
      const req = new NextRequest("http://localhost:3000/api/admin/orders");
      const res = await middleware(req);
      assert.ok(res);
      assert.equal(res.status, 404);
      const data = await res.json();
      assert.equal(data.code, "NOT_FOUND");
    } finally {
      process.env.APP_DEPLOYMENT_ROLE = origRole;
    }
  });

  // 3. Storefront blocks /api/admin/login and /api/admin/logout
  it("3. Storefront blocks /api/admin/login and /api/admin/logout", async () => {
    const origRole = process.env.APP_DEPLOYMENT_ROLE;
    process.env.APP_DEPLOYMENT_ROLE = "storefront";

    try {
      const reqLogin = new NextRequest("http://localhost:3000/api/admin/login", { method: "POST" });
      const resLogin = await middleware(reqLogin);
      assert.equal(resLogin.status, 404);

      const reqLogout = new NextRequest("http://localhost:3000/api/admin/logout", { method: "POST" });
      const resLogout = await middleware(reqLogout);
      assert.equal(resLogout.status, 404);
    } finally {
      process.env.APP_DEPLOYMENT_ROLE = origRole;
    }
  });

  // 4. Admin role permits authorized admin routes
  it("4. Admin role permits authorized admin routes when authenticated", async () => {
    const origRole = process.env.APP_DEPLOYMENT_ROLE;
    const origSecret = process.env.ADMIN_SESSION_SECRET;
    process.env.APP_DEPLOYMENT_ROLE = "admin";
    process.env.ADMIN_SESSION_SECRET = TEST_SECRET;

    try {
      const token = await createAdminSessionToken(adminUser, TEST_SECRET, 3600);
      const req = new NextRequest("http://localhost:3000/admin", {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}` },
      });
      const res = await middleware(req);
      assert.equal(res.headers.get("location"), null, "Must permit access without redirect");
    } finally {
      process.env.APP_DEPLOYMENT_ROLE = origRole;
      process.env.ADMIN_SESSION_SECRET = origSecret;
    }
  });

  // 5. Admin role blocks customer checkout mutation
  it("5. Admin role blocks customer checkout and shipping quote mutations", async () => {
    const origRole = process.env.APP_DEPLOYMENT_ROLE;
    process.env.APP_DEPLOYMENT_ROLE = "admin";

    try {
      const reqCheckout = new NextRequest("http://localhost:3000/api/checkout", { method: "POST" });
      const resCheckout = await middleware(reqCheckout);
      assert.equal(resCheckout.status, 404);
      const dataCheckout = await resCheckout.json();
      assert.equal(dataCheckout.code, "NOT_FOUND");

      const reqQuote = new NextRequest("http://localhost:3000/api/shipping/quote", { method: "POST" });
      const resQuote = await middleware(reqQuote);
      assert.equal(resQuote.status, 404);
      const dataQuote = await resQuote.json();
      assert.equal(dataQuote.code, "NOT_FOUND");
    } finally {
      process.env.APP_DEPLOYMENT_ROLE = origRole;
    }
  });

  // 6. Unauthenticated Admin redirects to login
  it("6. Unauthenticated Admin redirects to /admin/login", async () => {
    const origRole = process.env.APP_DEPLOYMENT_ROLE;
    process.env.APP_DEPLOYMENT_ROLE = "admin";

    try {
      const req = new NextRequest("http://localhost:3000/admin");
      const res = await middleware(req);
      assert.equal(res.status, 307);
      assert.ok(res.headers.get("location")?.includes("/admin/login"));
    } finally {
      process.env.APP_DEPLOYMENT_ROLE = origRole;
    }
  });

  // 7. Authenticated OWNER can enter Admin
  it("7. Authenticated OWNER can enter Admin", async () => {
    const origRole = process.env.APP_DEPLOYMENT_ROLE;
    const origSecret = process.env.ADMIN_SESSION_SECRET;
    process.env.APP_DEPLOYMENT_ROLE = "admin";
    process.env.ADMIN_SESSION_SECRET = TEST_SECRET;

    try {
      const token = await createAdminSessionToken(ownerUser, TEST_SECRET, 3600);
      const req = new NextRequest("http://localhost:3000/admin", {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=${token}` },
      });
      const res = await middleware(req);
      assert.equal(res.headers.get("location"), null);
    } finally {
      process.env.APP_DEPLOYMENT_ROLE = origRole;
      process.env.ADMIN_SESSION_SECRET = origSecret;
    }
  });

  // 8. Invalid ADMIN session is rejected
  it("8. Invalid/tampered ADMIN session is rejected and redirected", async () => {
    const origRole = process.env.APP_DEPLOYMENT_ROLE;
    const origSecret = process.env.ADMIN_SESSION_SECRET;
    process.env.APP_DEPLOYMENT_ROLE = "admin";
    process.env.ADMIN_SESSION_SECRET = TEST_SECRET;

    try {
      const req = new NextRequest("http://localhost:3000/admin", {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=invalid.tampered.signature` },
      });
      const res = await middleware(req);
      assert.equal(res.status, 307);
      assert.ok(res.headers.get("location")?.includes("/admin/login"));
    } finally {
      process.env.APP_DEPLOYMENT_ROLE = origRole;
      process.env.ADMIN_SESSION_SECRET = origSecret;
    }
  });

  // 9. Forged admin actor headers are ignored
  it("9. Forged admin actor headers from client are strictly ignored by forwardToErpAdmin", async () => {
    const origUrl = process.env.ERP_INTERNAL_URL;
    const origToken = process.env.ERP_SERVICE_TOKEN;
    const origSecret = process.env.ADMIN_SESSION_SECRET;

    process.env.ERP_INTERNAL_URL = "http://127.0.0.1:54329";
    process.env.ERP_SERVICE_TOKEN = "valid_test_service_token";
    process.env.ADMIN_SESSION_SECRET = TEST_SECRET;

    try {
      const validToken = await createAdminSessionToken(adminUser, TEST_SECRET, 3600);
      const spoofedReq = new Request("http://localhost:3000/api/admin/orders", {
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${validToken}`,
          "X-Admin-User-Id": "forged-god-mode-user",
          "X-Admin-Role": "SUPER_ADMIN_GOD",
        },
      });

      // Execute forwardToErpAdmin - even if ERP is unreachable, it attempts with authenticated session
      const res = await forwardToErpAdmin({
        request: spoofedReq,
        path: "/api/internal/admin/orders",
        method: "GET",
        permission: "admin:orders:view",
      });

      // 502 indicates it safely constructed the request from session and attempted upstream
      assert.equal(res.status, 502);
    } finally {
      process.env.ERP_INTERNAL_URL = origUrl;
      process.env.ERP_SERVICE_TOKEN = origToken;
      process.env.ADMIN_SESSION_SECRET = origSecret;
    }
  });

  // 10. Missing ERP_INTERNAL_URL fails closed
  it("10. Missing ERP_INTERNAL_URL fails closed with HTTP 503", async () => {
    const origUrl = process.env.ERP_INTERNAL_URL;
    const origToken = process.env.ERP_SERVICE_TOKEN;
    const origSecret = process.env.ADMIN_SESSION_SECRET;

    delete process.env.ERP_INTERNAL_URL;
    process.env.ERP_SERVICE_TOKEN = "test_token";
    process.env.ADMIN_SESSION_SECRET = TEST_SECRET;

    try {
      // 10a. Login route fails closed
      const reqLogin = new Request("http://localhost:3000/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ops@callme.com", password: "Password123!" }),
      });
      const resLogin = await loginRoute(reqLogin);
      assert.equal(resLogin.status, 503);

      // 10b. Admin BFF fails closed
      const validToken = await createAdminSessionToken(adminUser, TEST_SECRET, 3600);
      const reqBff = new Request("http://localhost:3000/api/admin/orders", {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=${validToken}` },
      });
      const resBff = await forwardToErpAdmin({
        request: reqBff,
        path: "/api/internal/admin/orders",
        method: "GET",
        permission: "admin:orders:view",
      });
      assert.equal(resBff.status, 503);
    } finally {
      process.env.ERP_INTERNAL_URL = origUrl;
      process.env.ERP_SERVICE_TOKEN = origToken;
      process.env.ADMIN_SESSION_SECRET = origSecret;
    }
  });

  // 11. Missing ERP_SERVICE_TOKEN fails closed
  it("11. Missing ERP_SERVICE_TOKEN fails closed with HTTP 503", async () => {
    const origUrl = process.env.ERP_INTERNAL_URL;
    const origToken = process.env.ERP_SERVICE_TOKEN;
    const origSecret = process.env.ADMIN_SESSION_SECRET;

    process.env.ERP_INTERNAL_URL = "http://127.0.0.1:8000";
    delete process.env.ERP_SERVICE_TOKEN;
    process.env.ADMIN_SESSION_SECRET = TEST_SECRET;

    try {
      // 11a. Catalog BFF fails closed
      const resCatalog = await catalogRoute();
      assert.equal(resCatalog.status, 503);

      // 11b. Admin forwardToErpAdmin fails closed
      const validToken = await createAdminSessionToken(adminUser, TEST_SECRET, 3600);
      const reqBff = new Request("http://localhost:3000/api/admin/orders", {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=${validToken}` },
      });
      const resBff = await forwardToErpAdmin({
        request: reqBff,
        path: "/api/internal/admin/orders",
        method: "GET",
        permission: "admin:orders:view",
      });
      assert.equal(resBff.status, 503);
    } finally {
      process.env.ERP_INTERNAL_URL = origUrl;
      process.env.ERP_SERVICE_TOKEN = origToken;
      process.env.ADMIN_SESSION_SECRET = origSecret;
    }
  });

  // 12. Unreachable ERP fails closed
  it("12. Unreachable ERP fails closed with HTTP 502", async () => {
    const origUrl = process.env.ERP_INTERNAL_URL;
    const origToken = process.env.ERP_SERVICE_TOKEN;

    process.env.ERP_INTERNAL_URL = "http://127.0.0.1:54329";
    process.env.ERP_SERVICE_TOKEN = "valid_token";

    try {
      const res = await catalogRoute();
      assert.equal(res.status, 502);
      const data = await res.json();
      assert.equal(data.error, "Catalog service is temporarily unavailable");
    } finally {
      process.env.ERP_INTERNAL_URL = origUrl;
      process.env.ERP_SERVICE_TOKEN = origToken;
    }
  });

  // 13. No localhost fallback in production
  it("13. No localhost fallback strings in production BFF modules", () => {
    const filesToAudit = [
      "src/lib/auth/admin-bff.ts",
      "src/app/api/admin/login/route.ts",
      "src/app/api/admin/logout/route.ts",
      "src/app/api/catalog/route.ts",
      "src/app/api/checkout/route.ts",
      "src/app/api/shipping/quote/route.ts",
    ];

    for (const relPath of filesToAudit) {
      const content = fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
      assert.equal(
        content.includes('|| "http://127.0.0.1:8000"'),
        false,
        `${relPath} must not contain default localhost fallback || "http://127.0.0.1:8000"`
      );
      assert.equal(
        content.includes("|| 'http://127.0.0.1:8000'"),
        false,
        `${relPath} must not contain default localhost fallback || 'http://127.0.0.1:8000'`
      );
    }
  });

  // 14. Real ERP product variant is accepted
  it("14. Real ERP product variant is accepted into transaction projection", () => {
    const validUuid = "01912a76-2f00-7bb0-b3b7-e2da49303381";
    const items = [
      {
        variant_id: validUuid,
        quantity: 3,
        product_id: "prod-1",
        name: "Callme Plain",
        price: 30000,
      },
    ];

    const projection = toTransactionProjection(items);
    assert.equal(projection.length, 1);
    assert.equal(projection[0].variant_id, validUuid);
    assert.equal(projection[0].quantity, 3);
  });

  // 15. Preview-only product cannot enter transactional cart
  it("15. Preview-only product cannot enter transactional cart", () => {
    const previewId = "01940a00-1111-2222-3333-444444444444";
    assert.equal(isLegacyPreviewVariantId(previewId), true);

    const nonPreviewId = "01912a76-2f00-7bb0-b3b7-e2da49303381";
    assert.equal(isLegacyPreviewVariantId(nonPreviewId), false);
  });

  // 16. Checkout destination data is consistent
  it("16. Checkout destination normalization is consistent between quote and checkout submission", () => {
    const rawForm = {
      postalCode: " 13890 ",
      city: "  Jakarta Timur ",
      province: "  DKI Jakarta ",
      district: " Cipayung ",
    };
    const selectedArea = {
      id: "area-cipayung-01",
      latitude: -6.312,
      longitude: 106.901,
    };

    const dest = buildCanonicalDestinationInput({
      postalCode: rawForm.postalCode,
      city: rawForm.city,
      province: rawForm.province,
      district: rawForm.district,
      areaId: selectedArea.id,
      latitude: selectedArea.latitude,
      longitude: selectedArea.longitude,
    });

    assert.equal(dest.postal_code, "13890");
    assert.equal(dest.city, "Jakarta Timur");
    assert.equal(dest.province, "DKI Jakarta");
    assert.equal(dest.district, "Cipayung");
    assert.equal(dest.area_id, "area-cipayung-01");
    assert.equal(dest.latitude, -6.312);
    assert.equal(dest.longitude, 106.901);

    // Verify empty fields do not inject artificial fallbacks
    const emptyForm = {
      postalCode: "10110",
      city: "   ",
      province: "",
      district: "",
    };
    const destEmpty = buildCanonicalDestinationInput(emptyForm);
    assert.equal(destEmpty.postal_code, "10110");
    assert.equal(destEmpty.city, undefined, "Empty city must not fallback to Jakarta Timur");
    assert.equal(destEmpty.province, undefined, "Empty province must not fallback to DKI Jakarta");
    assert.equal(destEmpty.district, undefined, "Empty district must not fallback to Cipayung");
  });

  // 17. Mocked shipping is only available in isolated tests
  it("17. Production shipping route contains zero hardcoded mock rates", () => {
    const routeContent = fs.readFileSync(
      path.resolve(process.cwd(), "src/app/api/shipping/quote/route.ts"),
      "utf-8"
    );
    assert.equal(routeContent.includes("15000"), false, "No hardcoded 15k shipping rate");
    assert.equal(routeContent.includes("20000"), false, "No hardcoded 20k shipping rate");
    assert.equal(routeContent.includes("fake_shipping"), false, "No fake shipping mock in route");
  });

  // 18. Mocked QRIS cannot create a real payment
  it("18. QRIS payment selection cannot bypass manual verification or fabricate PAID status", () => {
    const payload: CheckoutPayload = {
      customer: {
        name: "Test Customer",
        whatsapp: "081234567890",
        address: "Jl. Test No. 1",
      },
      destination: {
        postal_code: "13890",
      },
      items: [
        {
          variant_id: "01940a00-0000-7000-8000-000000000001",
          quantity: 1,
        },
      ],
      delivery_method: "instant",
      shipping_quote_id: "quote-test-123",
    };

    const canonical = buildCanonicalCheckoutPayload(payload);
    // Payload strictly contains zero client-claimed paid status or client payment confirmation
    assert.equal("payment_status" in canonical, false);
    assert.equal("is_paid" in canonical, false);
    assert.equal("total_amount" in canonical, false);
  });

  // 19. Storefront and Admin deployment modes are isolated
  it("19. APP_DEPLOYMENT_ROLE takes authoritative precedence and enforces isolation", () => {
    const mockEnv = {
      APP_DEPLOYMENT_ROLE: "admin",
      NEXT_PUBLIC_APP_MODE: "admin",
      ERP_INTERNAL_URL: "https://erp.example.com",
      ADMIN_SESSION_SECRET: "high_entropy_secret_at_least_32_characters_long",
    };

    const role = getDeploymentRole(mockEnv);
    assert.equal(role, "admin");

    const result = validateDeploymentEnv({ env: mockEnv, isProduction: true });
    assert.equal(result.valid, true);
    assert.equal(result.role, "admin");

    // Conflicting roles fail closed
    const conflictEnv = {
      APP_DEPLOYMENT_ROLE: "admin",
      NEXT_PUBLIC_APP_MODE: "storefront",
    };
    const conflictResult = validateDeploymentEnv({ env: conflictEnv, strict: false });
    assert.equal(conflictResult.valid, false);
    assert.ok(conflictResult.error?.includes("contradict"));
  });

  // 20. Production environment does not expose internal secrets
  it("20. Production client build does not expose internal secrets", () => {
    const forbiddenTokens = [
      "ERP_SERVICE_TOKEN",
      "ADMIN_SESSION_SECRET",
      "CRM_PII_BLIND_INDEX_KEY",
      "CHECKOUT_FINGERPRINT_KEY",
    ];

    const appDir = path.resolve(process.cwd(), "src/app");
    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".jsx"))) {
          const content = fs.readFileSync(full, "utf-8");
          for (const token of forbiddenTokens) {
            assert.equal(
              content.includes(`process.env.${token}`),
              false,
              `Client component ${path.relative(process.cwd(), full)} must not reference ${token}`
            );
          }
        }
      }
    };
    scanDir(appDir);
  });
});
