import { NextResponse } from "next/server.js";
import type { NextRequest } from "next/server.js";
import { getAdminSessionFromRequest } from "./lib/auth/admin-session.ts";
import { resolveDeploymentRole } from "./lib/env-validator.ts";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Authoritative server-side deployment role resolution (Phase 1.7C.22A)
  const resolved = resolveDeploymentRole(process.env);

  // In production or when invalid/contradicting, fail closed safely (503)
  if (!resolved.isValid || !resolved.role) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: resolved.error || "Server deployment role unconfigured", code: "CONFIGURATION_ERROR" },
        { status: 503 }
      );
    }
    return new NextResponse(resolved.error || "Server deployment role unconfigured", { status: 503 });
  }

  const deploymentRole = resolved.role;

  // =========================================================================
  // 1. STOREFRONT MODE ISOLATION
  // =========================================================================
  if (deploymentRole === "storefront") {
    // 1a. Block administrative API routes at server boundary (fail closed 404)
    // Includes /api/admin, /api/admin/login, /api/admin/logout, and any /api/admin/*
    if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) {
      return NextResponse.json(
        { error: "Admin operations are disabled on storefront deployment", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 1b. Block administrative UI routes (redirect to customer home)
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Customer-facing routes proceed normally
    return NextResponse.next();
  }

  // =========================================================================
  // 2. ADMIN MODE ISOLATION
  // =========================================================================
  if (deploymentRole === "admin") {
    // 2a. Block customer transactional endpoints not needed in Admin deployment
    if (pathname === "/api/checkout" || pathname.startsWith("/api/checkout/")) {
      return NextResponse.json(
        { error: "Customer checkout is disabled on admin deployment", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (pathname === "/api/shipping/quote" || pathname.startsWith("/api/shipping/quote/")) {
      return NextResponse.json(
        { error: "Customer shipping quote mutation is disabled on admin deployment", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 2b. Root path redirects to /admin
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  // =========================================================================
  // 3. ADMIN AUTHENTICATION & RBAC BOUNDARY
  // =========================================================================

  // 3a. Allow unauthenticated access to the admin login page
  if (pathname === "/admin/login") {
    // If already authenticated, redirect to /admin dashboard
    const existingSession = await getAdminSessionFromRequest(request);
    if (existingSession && (existingSession.user.role === "OWNER" || existingSession.user.role === "ADMIN")) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // 3b. Enforce Authentication Boundary on all /admin and /admin/* routes
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const session = await getAdminSessionFromRequest(request);

    if (!session) {
      // Unauthenticated: redirect to login
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role check: Only OWNER and ADMIN are allowed past the gateway boundary
    if (session.user.role !== "OWNER" && session.user.role !== "ADMIN") {
      const loginUrl = new URL("/admin/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // 3c. Protect any admin API routes if present (except public auth entry points)
  if (
    pathname.startsWith("/api/admin") &&
    pathname !== "/api/admin/login" &&
    pathname !== "/api/admin/logout"
  ) {
    const session = await getAdminSessionFromRequest(request);
    if (!session || (session.user.role !== "OWNER" && session.user.role !== "ADMIN")) {
      return NextResponse.json(
        { error: "Unauthorized admin access", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin",
    "/admin/:path*",
    "/api/admin",
    "/api/admin/:path*",
    "/api/checkout",
    "/api/checkout/:path*",
    "/api/shipping/quote",
    "/api/shipping/quote/:path*",
  ],
};
