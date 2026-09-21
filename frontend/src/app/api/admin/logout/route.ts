import { NextResponse } from "next/server.js";
import { ADMIN_COOKIE_NAME } from "../../../../lib/auth/admin-session.ts";

export async function POST(request: Request): Promise<Response> {
  const erpBaseUrl = process.env.ERP_INTERNAL_URL || "http://127.0.0.1:8000";
  const cookieHeader = request.headers.get("cookie") || "";

  try {
    await fetch(`${erpBaseUrl.replace(/\/$/, "")}/api/admin/logout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Cookie: cookieHeader,
      },
      cache: "no-store",
    });
  } catch {
    // Safe failure: client logout proceeds even if upstream is unreachable
  }

  const res = NextResponse.json(
    { message: "Logged out successfully" },
    { status: 200 }
  );

  // Clear HTTP-only session cookie
  res.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}
