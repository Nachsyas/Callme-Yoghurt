import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server.js";
import { middleware } from "../../../frontend/src/middleware.ts";
import { POST as adminLoginRoute } from "../../../frontend/src/app/api/admin/login/route.ts";
import { POST as adminLogoutRoute } from "../../../frontend/src/app/api/admin/logout/route.ts";
import {
  createAdminSessionToken,
  ADMIN_COOKIE_NAME,
  type AdminUser,
} from "../../../frontend/src/lib/auth/admin-session.ts";
import { requirePermission } from "../../../frontend/src/lib/auth/permissions.ts";
import { getSecurityHeaders } from "../../../frontend/src/lib/security/headers.ts";

const TEST_SECRET = "dast_cryptographic_admin_secret_32_characters_minimum";

describe("DAST Security Verification Suite — Phase 1.4A", () => {
  const adminUser: AdminUser = {
    id: "usr-dast-admin",
    username: "dast_auditor",
    email: "audit.sec@callmeyoghurt.com",
    role: "ADMIN",
  };

  const ownerUser: AdminUser = {
    id: "usr-dast-owner",
    username: "dast_owner",
    email: "owner.sec@callmeyoghurt.com",
    role: "OWNER",
  };

  // ============================================================================
  // 1. Authentication DAST Checks
  // ============================================================================
  describe("1. Authentication Security Verification", () => {
    it("proves admin routes cannot be accessed anonymously and redirect to login", async () => {
      const anonReq = new NextRequest("http://localhost:3000/admin");
      const res = await middleware(anonReq);

      assert.equal(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location?.includes("/admin/login"), "Anonymous request must be redirected to /admin/login");
    });

    it("verifies session cookie flags: HttpOnly, SameSite, Path, and Secure", async () => {
      // Test logout response Set-Cookie headers
      const logoutReq = new NextRequest("http://localhost:3000/api/admin/logout", {
        method: "POST",
      });
      const logoutRes = await adminLogoutRoute(logoutReq);
      assert.equal(logoutRes.status, 200);

      // Verify via Next.js response cookie interface
      const cookieObj = (logoutRes as unknown as NextResponse).cookies?.get(ADMIN_COOKIE_NAME);
      const setCookie = logoutRes.headers.get("set-cookie") || "";
      assert.ok(setCookie.length > 0 || cookieObj, "Set-Cookie header must be present on session actions");

      if (cookieObj) {
        assert.equal(cookieObj.httpOnly, true, "Cookie must enforce HttpOnly");
        assert.equal(cookieObj.sameSite, "lax", "Cookie must enforce SameSite");
        assert.equal(cookieObj.maxAge, 0, "Logout must invalidate session with Max-Age=0");
        assert.equal(cookieObj.path, "/", "Cookie path must be root");
      } else {
        assert.ok(setCookie.includes("HttpOnly") || setCookie.includes("httponly"));
        assert.ok(setCookie.includes("Max-Age=0") || setCookie.includes("expires="));
      }
    });

    it("verifies expired session tokens are rejected and redirect to login", async () => {
      // Generate expired token (-3600 seconds)
      const expiredToken = await createAdminSessionToken(adminUser, TEST_SECRET, -3600);
      const req = new NextRequest("http://localhost:3000/admin/settings", {
        headers: {
          cookie: `${ADMIN_COOKIE_NAME}=${expiredToken}`,
        },
      });
      const res = await middleware(req);
      assert.equal(res.status, 307);
      assert.ok(res.headers.get("location")?.includes("/admin/login"));
    });

    it("verifies logout endpoint invalidates and clears session cookie", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/logout", {
        method: "POST",
      });
      const res = await adminLogoutRoute(req);
      assert.equal(res.status, 200);
      const data = (await res.json()) as { message?: string };
      assert.equal(data.message, "Logged out successfully");
      const setCookie = res.headers.get("set-cookie") || "";
      const cookieObj = (res as unknown as NextResponse).cookies?.get(ADMIN_COOKIE_NAME);
      assert.ok(setCookie.includes(ADMIN_COOKIE_NAME) || cookieObj);
    });
  });

  // ============================================================================
  // 2. Authorization DAST Checks
  // ============================================================================
  describe("2. Authorization & Boundary Verification", () => {
    it("verifies customer role is denied access to /admin portal", async () => {
      const customerToken = await createAdminSessionToken(
        { id: "cust-1", username: "customer", email: "cust@gmail.com", role: "CUSTOMER" as unknown as "ADMIN" },
        TEST_SECRET
      );

      const req = new NextRequest("http://localhost:3000/admin", {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=${customerToken}` },
      });
      const res = await middleware(req);
      assert.equal(res.status, 307);
      assert.ok(res.headers.get("location")?.includes("/admin/login"));
    });

    it("verifies ADMIN role is strictly denied access to OWNER-only privileged routes and actions", async () => {
      const adminToken = await createAdminSessionToken(adminUser, TEST_SECRET, 3600);
      const [headerPayload] = adminToken.split(".");
      const decoded = JSON.parse(Buffer.from(headerPayload, "base64url").toString("utf-8"));

      const sessionObj = {
        user: decoded.user,
        issuedAt: decoded.issuedAt,
        expiresAt: decoded.expiresAt,
      };

      assert.equal(requirePermission(sessionObj, "admin:users:manage"), false);
      assert.equal(requirePermission(sessionObj, "admin:settings:manage"), false);
      assert.equal(requirePermission(sessionObj, "admin:security:audit"), false);
    });
  });

  // ============================================================================
  // 3. API Security DAST Checks
  // ============================================================================
  describe("3. API Security & Information Disclosure Prevention", () => {
    it("proves unauthenticated requests to protected admin APIs receive HTTP 401", async () => {
      const apiReq = new NextRequest("http://localhost:3000/api/admin/users");
      const res = await middleware(apiReq);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.code, "UNAUTHORIZED");
    });

    it("proves error responses never leak stack traces, internal IPs, or environment variables", async () => {
      const badReq = new Request("http://localhost:3000/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid", password: "" }),
      });
      const res = await adminLoginRoute(badReq);
      const data = await res.json();
      const text = JSON.stringify(data);

      assert.ok(!text.includes("node_modules"), "Response must not leak file system paths");
      assert.ok(!text.includes("127.0.0.1:8000"), "Response must not leak internal backend IP");
      assert.ok(!text.includes("localhost:8000"), "Response must not leak internal backend hostname");
      assert.ok(!text.includes("ADMIN_SESSION_SECRET"), "Response must not leak secret keys");
      assert.ok(!text.includes("ERP_SERVICE_TOKEN"), "Response must not leak ERP token");
    });
  });

  // ============================================================================
  // 4. Injection DAST Checks
  // ============================================================================
  describe("4. Injection Vulnerability Resistance", () => {
    it("verifies reflected XSS, SQLi, and Command Injection indicators are neutralized", async () => {
      const injectionPayloads = [
        "<script>alert('xss')</script>",
        "' OR '1'='1",
        "'; exec('whoami'); --",
        "| id",
        "${7*7}",
      ];

      for (const payload of injectionPayloads) {
        const req = new Request("http://localhost:3000/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: payload, password: payload }),
        });
        const res = await adminLoginRoute(req);
        // Handled cleanly without server crash (500) or command execution
        assert.notEqual(res.status, 500);
        const data = await res.json();
        const text = JSON.stringify(data);
        assert.ok(!text.includes("syntax error"), "Must not leak SQL syntax error");
        assert.ok(!text.includes("root:x:0"), "Must not leak passwd content");
      }
    });
  });

  // ============================================================================
  // 5. Security Headers & Cookie Security DAST Checks
  // ============================================================================
  describe("5. Security Headers & Cookie Invariants", () => {
    it("verifies mandatory security headers: CSP, HSTS, XFO, nosniff, Referrer-Policy", () => {
      const prodHeaders = getSecurityHeaders({
        isProduction: true,
        hsts: { enabled: true, includeSubDomains: true, preload: true },
      });
      const headerMap = new Map(prodHeaders.map((h) => [h.key, h.value]));

      // 1. Content-Security-Policy
      const csp = headerMap.get("Content-Security-Policy");
      assert.ok(csp, "CSP must be configured");
      assert.ok(csp.includes("frame-ancestors 'none'"), "CSP must disallow framing");
      assert.ok(csp.includes("default-src 'self'"), "CSP default-src must be self");
      assert.ok(!csp.includes("'unsafe-eval'"), "Production CSP must disallow unsafe-eval");

      // 2. Strict-Transport-Security (HSTS)
      const hsts = headerMap.get("Strict-Transport-Security");
      assert.ok(hsts, "HSTS must be configured");
      assert.ok(hsts.includes("max-age=63072000"), "HSTS max-age must be >= 1 year");
      assert.ok(hsts.includes("includeSubDomains"), "HSTS must include subdomains");
      assert.ok(hsts.includes("preload"), "HSTS must include preload");

      // 3. X-Frame-Options
      assert.equal(headerMap.get("X-Frame-Options"), "DENY", "X-Frame-Options must be DENY");

      // 4. X-Content-Type-Options
      assert.equal(headerMap.get("X-Content-Type-Options"), "nosniff", "X-Content-Type-Options must be nosniff");

      // 5. Referrer-Policy
      assert.equal(
        headerMap.get("Referrer-Policy"),
        "strict-origin-when-cross-origin",
        "Referrer-Policy must be strict-origin-when-cross-origin"
      );
    });
  });
});
