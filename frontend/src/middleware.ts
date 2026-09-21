import { NextResponse } from "next/server.js";
import type { NextRequest } from "next/server.js";
import { getAdminSessionFromRequest } from "./lib/auth/admin-session.ts";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const appMode = process.env.NEXT_PUBLIC_APP_MODE;

  // 1. Storefront Isolation: If explicitly deployed in storefront mode, block /admin access
  if (appMode === "storefront" && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 2. Allow unauthenticated access to the admin login page
  if (pathname === "/admin/login") {
    // If already authenticated, redirect to /admin dashboard
    const existingSession = await getAdminSessionFromRequest(request);
    if (existingSession) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  // 3. Enforce Authentication Boundary on all /admin and /admin/* routes
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

  // 4. Protect any admin API routes if present (except public auth entry points)
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
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};
