import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import {
  createAdminSessionToken,
  verifyAdminSession,
  getAdminSessionFromRequest,
  ADMIN_COOKIE_NAME,
  type AdminUser,
} from "../../src/lib/auth/admin-session.ts";
import { hasPermission, requirePermission } from "../../src/lib/auth/permissions.ts";
import { middleware } from "../../src/middleware.ts";

const TEST_SECRET = "test_cryptographically_secure_admin_session_key_32c";

describe("Admin Access Control Hardening & Deployment Separation (Phase 1.2A)", () => {
  const ownerUser: AdminUser = {
    id: "usr-owner-001",
    username: "superowner",
    email: "owner@callmeyoghurt.com",
    role: "OWNER",
  };

  const adminUser: AdminUser = {
    id: "usr-admin-001",
    username: "opsadmin",
    email: "ops@callmeyoghurt.com",
    role: "ADMIN",
  };

  describe("Route boundary protection (middleware.ts)", () => {
    it("Test 1: unauthenticated user accessing /admin is rejected and redirected to login", async () => {
      const unauthReq = new NextRequest("http://localhost:3000/admin");
      const res = await middleware(unauthReq);

      assert.ok(res, "Middleware must return a response");
      assert.equal(res.status, 307, "Must return HTTP 307 temporary redirect");
      const location = res.headers.get("location");
      assert.ok(location, "Must have Location header");
      assert.ok(location.includes("/admin/login"), "Must redirect unauthenticated user to /admin/login");
      assert.ok(location.includes("from=%2Fadmin"), "Must preserve destination in redirect URL");
    });

    it("allows unauthenticated access to /admin/login without redirect loop", async () => {
      const loginReq = new NextRequest("http://localhost:3000/admin/login");
      const res = await middleware(loginReq);

      assert.ok(res);
      assert.equal(res.headers.get("location"), null, "Must not redirect away from login page");
    });

    it("unauthenticated request to admin API endpoints fails closed with HTTP 401", async () => {
      const apiReq = new NextRequest("http://localhost:3000/api/admin/catalog");
      const res = await middleware(apiReq);

      assert.ok(res);
      assert.equal(res.status, 401, "Admin API must return 401 for unauthenticated caller");
    });

    it("isolates /admin route completely when deployed in storefront app mode", async () => {
      const originalMode = process.env.NEXT_PUBLIC_APP_MODE;
      process.env.NEXT_PUBLIC_APP_MODE = "storefront";

      try {
        const req = new NextRequest("http://localhost:3000/admin");
        const res = await middleware(req);

        assert.ok(res);
        assert.equal(res.status, 307);
        const location = res.headers.get("location");
        assert.ok(location?.endsWith("/"), "Storefront mode must redirect /admin to storefront home");
      } finally {
        process.env.NEXT_PUBLIC_APP_MODE = originalMode;
      }
    });
  });

  describe("Customer vs Admin session boundary", () => {
    it("Test 2: customer session / untrusted identity cannot access admin", async () => {
      // Simulate an identity with customer role
      const customerPayload = {
        user: {
          id: "cust-01",
          username: "customer_budi",
          email: "budi@example.com",
          role: "CUSTOMER", // Not OWNER or ADMIN
        },
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };

      const encoded = Buffer.from(JSON.stringify(customerPayload)).toString("base64url");
      const fakeToken = `${encoded}.fake_or_valid_signature`;

      const session = await verifyAdminSession(fakeToken, TEST_SECRET);
      assert.equal(session, null, "Customer identity must be rejected by admin session verifier");

      // Verify request with customer token in cookie is rejected at middleware boundary
      const req = new NextRequest("http://localhost:3000/admin", {
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${fakeToken}`,
        },
      });

      const res = await middleware(req);
      assert.equal(res.status, 307);
      assert.ok(res.headers.get("location")?.includes("/admin/login"));
    });
  });

  describe("Session integrity and fail-closed validation", () => {
    it("Test 3: invalid, expired, or tampered admin session fails closed", async () => {
      // 1. Expired token
      const expiredToken = await createAdminSessionToken(adminUser, TEST_SECRET, -60);
      assert.equal(await verifyAdminSession(expiredToken, TEST_SECRET), null, "Expired token must return null");

      // 2. Tampered signature
      const validToken = await createAdminSessionToken(adminUser, TEST_SECRET, 3600);
      const [payloadPart, sigPart] = validToken.split(".");
      const tamperedToken = `${payloadPart}.${sigPart.slice(0, -4)}XXXX`;
      assert.equal(await verifyAdminSession(tamperedToken, TEST_SECRET), null, "Tampered signature must return null");

      // 3. Malformed token
      assert.equal(await verifyAdminSession("gibberish-no-dot", TEST_SECRET), null, "Malformed token must return null");
      assert.equal(await verifyAdminSession("", TEST_SECRET), null, "Empty token must return null");

      // 4. Missing secret in production fails closed
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.ADMIN_SESSION_SECRET;
      delete process.env.ADMIN_SESSION_SECRET;
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";

      try {
        const res = await verifyAdminSession(validToken);
        assert.equal(res, null, "Missing production secret must fail closed and return null");
      } finally {
        (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
        if (originalSecret !== undefined) {
          process.env.ADMIN_SESSION_SECRET = originalSecret;
        }
      }
    });
  });

  describe("Role authorization and privilege hierarchy", () => {
    it("Test 4: OWNER role can access admin and full permissions", async () => {
      const ownerToken = await createAdminSessionToken(ownerUser, TEST_SECRET, 3600);

      // Verify middleware allows request with valid OWNER token
      const req = new NextRequest("http://localhost:3000/admin", {
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${ownerToken}`,
        },
      });

      // Provide secret in environment for middleware
      const prevSecret = process.env.ADMIN_SESSION_SECRET;
      process.env.ADMIN_SESSION_SECRET = TEST_SECRET;

      try {
        const res = await middleware(req);
        assert.equal(res.headers.get("location"), null, "Valid OWNER session must NOT be redirected");

        // Verify OWNER has access to all operational and privileged permissions
        assert.equal(hasPermission("OWNER", "admin:dashboard:view"), true);
        assert.equal(hasPermission("OWNER", "admin:catalog:manage"), true);
        assert.equal(hasPermission("OWNER", "admin:inventory:manage"), true);
        assert.equal(hasPermission("OWNER", "admin:orders:manage"), true);
        assert.equal(hasPermission("OWNER", "admin:settings:manage"), true);
        assert.equal(hasPermission("OWNER", "admin:users:manage"), true);
        assert.equal(hasPermission("OWNER", "admin:security:audit"), true);

        const session = await verifyAdminSession(ownerToken, TEST_SECRET);
        assert.equal(requirePermission(session, "admin:users:manage"), true);
        assert.equal(requirePermission(session, "admin:security:audit"), true);
      } finally {
        process.env.ADMIN_SESSION_SECRET = prevSecret;
      }
    });

    it("Test 5: ADMIN role cannot access OWNER-only features", async () => {
      const adminToken = await createAdminSessionToken(adminUser, TEST_SECRET, 3600);

      const prevSecret = process.env.ADMIN_SESSION_SECRET;
      process.env.ADMIN_SESSION_SECRET = TEST_SECRET;

      try {
        // ADMIN can access dashboard and operational management
        assert.equal(hasPermission("ADMIN", "admin:dashboard:view"), true);
        assert.equal(hasPermission("ADMIN", "admin:catalog:view"), true);
        assert.equal(hasPermission("ADMIN", "admin:catalog:manage"), true);
        assert.equal(hasPermission("ADMIN", "admin:inventory:view"), true);
        assert.equal(hasPermission("ADMIN", "admin:inventory:manage"), true);
        assert.equal(hasPermission("ADMIN", "admin:orders:view"), true);
        assert.equal(hasPermission("ADMIN", "admin:orders:manage"), true);

        // ADMIN is STRICTLY FORBIDDEN from OWNER-only features
        assert.equal(hasPermission("ADMIN", "admin:settings:manage"), false, "ADMIN must not manage settings");
        assert.equal(hasPermission("ADMIN", "admin:users:manage"), false, "ADMIN must not manage users");
        assert.equal(hasPermission("ADMIN", "admin:security:audit"), false, "ADMIN must not access security audit");

        const session = await verifyAdminSession(adminToken, TEST_SECRET);
        assert.equal(requirePermission(session, "admin:orders:manage"), true);
        assert.equal(requirePermission(session, "admin:users:manage"), false);
        assert.equal(requirePermission(session, "admin:settings:manage"), false);
        assert.equal(requirePermission(session, "admin:security:audit"), false);
      } finally {
        process.env.ADMIN_SESSION_SECRET = prevSecret;
      }
    });

    it("fails closed for unknown or arbitrary roles", () => {
      assert.equal(hasPermission("CUSTOMER", "admin:dashboard:view"), false);
      assert.equal(hasPermission("GUEST", "admin:dashboard:view"), false);
      assert.equal(hasPermission("", "admin:dashboard:view"), false);
    });
  });
});
