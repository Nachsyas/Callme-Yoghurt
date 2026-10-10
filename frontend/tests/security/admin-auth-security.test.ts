import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server.js";
import { POST as loginRoute } from "../../src/app/api/admin/login/route.ts";
import { POST as logoutRoute } from "../../src/app/api/admin/logout/route.ts";
import {
  createAdminSessionToken,
  ADMIN_COOKIE_NAME,
  type AdminUser,
} from "../../src/lib/auth/admin-session.ts";
import { middleware } from "../../src/middleware.ts";

const TEST_SECRET = "test_cryptographically_secure_admin_session_key_32c";

describe("Admin Authentication & Session Security (Phase 1.2B)", () => {
  const adminUser: AdminUser = {
    id: "usr-admin-777",
    username: "ops_lead",
    email: "ops@callmeyoghurt.com",
    role: "ADMIN",
  };

  describe("API login handler security", () => {
    it("proves malformed or non-JSON payloads are safely rejected with HTTP 400", async () => {
      const badReq = new Request("http://localhost:3000/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json{",
      });

      const res = await loginRoute(badReq);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, "Invalid JSON payload");
    });

    it("proves missing or empty credentials return sanitized HTTP 401 Invalid credentials", async () => {
      const emptyReq = new Request("http://localhost:3000/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "", password: "" }),
      });

      const res = await loginRoute(emptyReq);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, "Invalid credentials");
      // Never leak internals
      assert.equal("exception" in data, false);
      assert.equal("stack" in data, false);
    });

    it("proves login errors are sanitized and never leak stack traces or connection strings", async () => {
      // Simulate upstream unavailability
      const originalUrl = process.env.ERP_INTERNAL_URL;
      process.env.ERP_INTERNAL_URL = "http://127.0.0.1:54329"; // unreachable port

      try {
        const req = new Request("http://localhost:3000/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "admin@callmeyoghurt.com", password: "Password123!" }),
        });

        const res = await loginRoute(req);
        assert.equal(res.status, 502);
        const data = await res.json();
        assert.equal(data.error, "Authentication service unavailable");
        assert.equal("stack" in data, false);
        assert.equal("dsn" in data, false);
      } finally {
        process.env.ERP_INTERNAL_URL = originalUrl;
      }
    });
  });

  describe("Token storage security invariants", () => {
    it("proves login page code NEVER writes session tokens to localStorage or sessionStorage", () => {
      const loginPagePath = path.resolve(
        process.cwd(),
        "src/app/admin/login/page.tsx"
      );
      const content = fs.readFileSync(loginPagePath, "utf-8");

      assert.equal(
        content.includes("localStorage.setItem"),
        false,
        "localStorage.setItem must NEVER be used for session tokens"
      );
      assert.equal(
        content.includes("sessionStorage.setItem"),
        false,
        "sessionStorage.setItem must NEVER be used for session tokens"
      );
      assert.ok(
        content.includes("HTTP-only cookie"),
        "Must document HTTP-only cookie policy"
      );
    });
  });

  describe("Protected route access after session establishment", () => {
    it("proves valid session cookie grants access to protected /admin dashboard", async () => {
      const prevSecret = process.env.ADMIN_SESSION_SECRET;
      process.env.ADMIN_SESSION_SECRET = TEST_SECRET;

      try {
        const token = await createAdminSessionToken(adminUser, TEST_SECRET, 3600);

        const req = new NextRequest("http://localhost:3000/admin", {
          headers: {
            cookie: `${ADMIN_COOKIE_NAME}=${token}`,
          },
        });

        const res = await middleware(req);
        // Middleware allows valid session without redirecting to login
        assert.equal(
          res.headers.get("location"),
          null,
          "Authenticated admin must NOT be redirected"
        );
      } finally {
        process.env.ADMIN_SESSION_SECRET = prevSecret;
      }
    });

    it("proves unauthenticated request is redirected to /admin/login", async () => {
      const req = new NextRequest("http://localhost:3000/admin");
      const res = await middleware(req);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location?.includes("/admin/login"));
    });
  });

  describe("Logout session termination", () => {
    it("proves logout handler clears the session cookie and returns 200", async () => {
      const req = new Request("http://localhost:3000/api/admin/logout", {
        method: "POST",
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=valid_or_invalid_token`,
        },
      });

      const res = await logoutRoute(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.message, "Logged out successfully");

      // Verify cookie is cleared
      const setCookie = res.headers.get("set-cookie");
      assert.ok(setCookie, "Must set cookie header on logout");
      assert.ok(
        setCookie.includes("Max-Age=0") || setCookie.includes("expires="),
        "Cookie must be expired on logout"
      );
      assert.ok(setCookie.includes("HttpOnly"), "Cleared cookie must remain HttpOnly");
    });
  });
});
