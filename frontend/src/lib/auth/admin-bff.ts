import { NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "./admin-session.ts";
import { requirePermission, type AdminPermission } from "./permissions.ts";

export interface ForwardAdminOptions {
  request: Request;
  permission: AdminPermission;
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

/**
 * Authoritative BFF helper for Admin Console requests.
 * Enforces:
 * 1. Admin session authentication via callme_admin_session cookie
 * 2. Strict RBAC permission verification (OWNER or ADMIN with permission)
 * 3. Strips any incoming browser X-Admin-* headers
 * 4. Injects server-generated X-Admin-User-Id and X-Admin-Role headers
 * 5. Injects secret Bearer ERP_SERVICE_TOKEN (never leaked to browser)
 * 6. Returns sanitized response
 */
export async function forwardToErpAdmin(options: ForwardAdminOptions): Promise<Response> {
  const { request, permission, path, method = "GET", body } = options;

  // 1. Session verification
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized: active admin session required" },
      { status: 401 }
    );
  }

  // 2. Permission check
  if (!requirePermission(session, permission)) {
    return NextResponse.json(
      { error: "Forbidden: insufficient permissions for this operation" },
      { status: 403 }
    );
  }

  // 3. Upstream configuration
  const erpBaseUrl = process.env.ERP_INTERNAL_URL || "http://127.0.0.1:8000";
  const serviceToken = process.env.ERP_SERVICE_TOKEN;

  if (!serviceToken) {
    return NextResponse.json(
      { error: "ERP service token unconfigured" },
      { status: 503 }
    );
  }

  const url = `${erpBaseUrl.replace(/\/$/, "")}${path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${serviceToken}`,
    // Authoritative server-generated actor identity (ignoring browser-supplied headers)
    "X-Admin-User-Id": session.user.id,
    "X-Admin-Role": session.user.role,
    "X-Forwarded-For": request.headers.get("x-forwarded-for") || "127.0.0.1",
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (body !== undefined && method !== "GET") {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(body);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  fetchOptions.signal = controller.signal;

  try {
    const upstream = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    clearTimeout(timeoutId);
    return NextResponse.json(
      { error: "ERP Core service unavailable" },
      { status: 502 }
    );
  }
}
