import { NextResponse } from "next/server.js";

const UPSTREAM_TIMEOUT_MS = 5000;

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("email" in body) ||
    !("password" in body) ||
    typeof (body as Record<string, unknown>).email !== "string" ||
    typeof (body as Record<string, unknown>).password !== "string"
  ) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const { email, password } = body as { email: string; password: string };
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedEmail || !password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const erpBaseUrl = process.env.ERP_INTERNAL_URL || "http://127.0.0.1:8000";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${erpBaseUrl.replace(/\/$/, "")}/api/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Forwarded-For": request.headers.get("x-forwarded-for") || "127.0.0.1",
      },
      body: JSON.stringify({ email: trimmedEmail, password }),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (upstream.status === 401) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (upstream.status === 429) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 }
      );
    }

    if (!upstream.ok) {
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 502 });
    }

    const data = await upstream.json();

    const res = NextResponse.json(
      {
        user: data.user,
        session_created: true,
      },
      { status: 200 }
    );

    const upstreamCookie = upstream.headers.get("set-cookie");
    if (upstreamCookie) {
      res.headers.set("set-cookie", upstreamCookie);
    }

    return res;
  } catch {
    clearTimeout(timeoutId);
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 502 });
  }
}
