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
import { GET as catalogRoute } from "../../src/app/api/catalog/route.ts";
import { POST as checkoutRoute } from "../../src/app/api/checkout/route.ts";
import { POST as loginRoute } from "../../src/app/api/admin/login/route.ts";

const TEST_SECRET = "test_cryptographically_secure_admin_session_key_32c";

describe("Vercel Staging Deployment Boundary & Security Isolation (Phase 1.2C)", () => {
  const adminUser: AdminUser = {
    id: "usr-admin-ops",
    username: "deploy_lead",
    email: "lead@callmeyoghurt.com",
    role: "ADMIN",
  };

  describe("Test 1: Storefront mode (/admin must not expose dashboard)", () => {
    it("redirects /admin and /admin/* to customer home (/) when deployed in storefront mode", async () => {
      const originalMode = process.env.NEXT_PUBLIC_APP_MODE;
      process.env.NEXT_PUBLIC_APP_MODE = "storefront";

      try {
        const reqAdmin = new NextRequest("http://localhost:3000/admin");
        const resAdmin = await middleware(reqAdmin);

        assert.ok(resAdmin);
        assert.equal(resAdmin.status, 307);
        const locAdmin = resAdmin.headers.get("location");
        assert.ok(locAdmin?.endsWith("/"), "Storefront mode must redirect /admin to /");

        const reqSub = new NextRequest("http://localhost:3000/admin/settings");
        const resSub = await middleware(reqSub);
        assert.equal(resSub.status, 307);
        assert.ok(resSub.headers.get("location")?.endsWith("/"), "Storefront mode must redirect /admin/* to /");
      } finally {
        process.env.NEXT_PUBLIC_APP_MODE = originalMode;
      }
    });
  });

  describe("Test 2: Admin mode (/admin requires authentication)", () => {
    it("redirects unauthenticated callers to /admin/login when deployed in admin mode", async () => {
      const originalMode = process.env.NEXT_PUBLIC_APP_MODE;
      process.env.NEXT_PUBLIC_APP_MODE = "admin";

      try {
        const req = new NextRequest("http://localhost:3000/admin");
        const res = await middleware(req);

        assert.ok(res);
        assert.equal(res.status, 307);
        const loc = res.headers.get("location");
        assert.ok(loc?.includes("/admin/login"), "Admin mode must redirect unauthenticated /admin to /admin/login");

        // Root on admin domain redirects to /admin
        const reqRoot = new NextRequest("http://localhost:3000/");
        const resRoot = await middleware(reqRoot);
        assert.equal(resRoot.status, 307);
        assert.ok(resRoot.headers.get("location")?.endsWith("/admin"), "Admin domain root must redirect to /admin");
      } finally {
        process.env.NEXT_PUBLIC_APP_MODE = originalMode;
      }
    });

    it("grants access to /admin when a cryptographically valid admin session is provided", async () => {
      const originalMode = process.env.NEXT_PUBLIC_APP_MODE;
      const originalSecret = process.env.ADMIN_SESSION_SECRET;
      process.env.NEXT_PUBLIC_APP_MODE = "admin";
      process.env.ADMIN_SESSION_SECRET = TEST_SECRET;

      try {
        const token = await createAdminSessionToken(adminUser, TEST_SECRET, 3600);
        const req = new NextRequest("http://localhost:3000/admin", {
          headers: {
            cookie: `${ADMIN_COOKIE_NAME}=${token}`,
          },
        });

        const res = await middleware(req);
        assert.equal(res.headers.get("location"), null, "Authenticated admin session must NOT be redirected");
      } finally {
        process.env.NEXT_PUBLIC_APP_MODE = originalMode;
        process.env.ADMIN_SESSION_SECRET = originalSecret;
      }
    });
  });

  describe("Test 3: Environment secrets must not appear in client bundle", () => {
    it("proves server-side secrets and credentials are absent from client source code and build outputs", () => {
      const forbiddenTokens = [
        "ERP_SERVICE_TOKEN",
        "ADMIN_SESSION_SECRET",
        "REDIS_URL",
        "callme_dev_service_secret_token",
        "callme_dev_redis_insecure_password",
        "callme_dev_admin_session_secret",
      ];

      // 1. Audit client-side component files in src/app (excluding server-only route.ts files)
      const appDir = path.resolve(process.cwd(), "src/app");
      const clientFiles: string[] = [];

      const walkDir = (dir: string): void => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".jsx"))) {
            clientFiles.push(fullPath);
          }
        }
      }

      walkDir(appDir);

      for (const file of clientFiles) {
        const content = fs.readFileSync(file, "utf-8");
        for (const token of forbiddenTokens) {
          assert.equal(
            content.includes(`process.env.${token}`),
            false,
            `Client component ${path.relative(process.cwd(), file)} must never reference server secret ${token}`
          );
        }
      }

      // 2. Audit compiled client chunks in .next/static if build artifacts exist
      const staticDir = path.resolve(process.cwd(), ".next/static");
      if (fs.existsSync(staticDir)) {
        const chunkFiles: string[] = [];
        const walkStatic = (dir: string): void => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              walkStatic(fullPath);
            } else if (entry.isFile() && entry.name.endsWith(".js")) {
              chunkFiles.push(fullPath);
            }
          }
        }
        walkStatic(staticDir);

        for (const chunk of chunkFiles) {
          const chunkContent = fs.readFileSync(chunk, "utf-8");
          for (const token of [
            "callme_dev_service_secret_token",
            "callme_dev_redis_insecure_password",
            "callme_dev_admin_session_secret",
          ]) {
            assert.equal(
              chunkContent.includes(token),
              false,
              `Compiled client chunk ${path.basename(chunk)} must never contain secret ${token}`
            );
          }
        }
      }
    });
  });

  describe("Test 4: API responses must not leak ERP configuration", () => {
    it("proves catalog BFF response sanitizes upstream failures and never leaks internal URLs or tokens", async () => {
      const originalUrl = process.env.ERP_INTERNAL_URL;
      const originalToken = process.env.ERP_SERVICE_TOKEN;

      // Use unbound port for immediate connection refusal
      process.env.ERP_INTERNAL_URL = "http://127.0.0.1:54329/private-erp";
      process.env.ERP_SERVICE_TOKEN = "super_secret_private_bearer_token";

      try {
        const res = await catalogRoute();
        assert.equal(res.status, 502);

        const data = await res.json();
        const rawBody = JSON.stringify(data);

        assert.equal(rawBody.includes("54329"), false, "Must never leak internal port");
        assert.equal(rawBody.includes("private-erp"), false, "Must never leak internal path");
        assert.equal(rawBody.includes("super_secret_private_bearer_token"), false, "Must never leak bearer token");
        assert.equal(rawBody.includes("password"), false, "Must never leak password string");
      } finally {
        process.env.ERP_INTERNAL_URL = originalUrl;
        process.env.ERP_SERVICE_TOKEN = originalToken;
      }
    });

    it("proves checkout BFF response sanitizes upstream transport failures without leaking secrets", async () => {
      const originalUrl = process.env.ERP_INTERNAL_URL;
      const originalToken = process.env.ERP_SERVICE_TOKEN;

      // Use unbound port for immediate connection refusal
      process.env.ERP_INTERNAL_URL = "http://127.0.0.1:54329";
      process.env.ERP_SERVICE_TOKEN = "confidential_erp_secret_token_value";

      try {
        const req = new Request("http://localhost:3000/api/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": "test-idempotency-key-001",
          },
          body: JSON.stringify({
            customer: {
              name: "Siti Rahma",
              whatsapp: "081234567890",
              address: "Jl. Sudirman No. 1, Jakarta",
            },
            items: [
              {
                variant_id: "01912a76-2f00-7bb0-b3b7-e2da49303381",
                quantity: 2,
              },
            ],
            delivery_method: "instant",
          }),
        });

        const res = await checkoutRoute(req);
        assert.equal(res.status, 502);

        const data = await res.json();
        const rawBody = JSON.stringify(data);

        assert.equal(rawBody.includes("54329"), false);
        assert.equal(rawBody.includes("confidential_erp_secret_token_value"), false);
        assert.equal(rawBody.includes("SQLSTATE"), false);
      } finally {
        process.env.ERP_INTERNAL_URL = originalUrl;
        process.env.ERP_SERVICE_TOKEN = originalToken;
      }
    });

    it("proves admin login BFF response sanitizes failure without leaking upstream ERP details", async () => {
      const originalUrl = process.env.ERP_INTERNAL_URL;
      process.env.ERP_INTERNAL_URL = "http://127.0.0.1:54329";

      try {
        const req = new Request("http://localhost:3000/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "ops@callmeyoghurt.com", password: "Password123!" }),
        });

        const res = await loginRoute(req);
        assert.equal(res.status, 502);

        const data = await res.json();
        const rawBody = JSON.stringify(data);

        assert.equal(rawBody.includes("54329"), false);
      } finally {
        process.env.ERP_INTERNAL_URL = originalUrl;
      }
    });
  });
});
