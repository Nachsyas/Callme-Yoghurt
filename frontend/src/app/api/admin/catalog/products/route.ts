import { forwardToErpAdmin } from "@/lib/auth/admin-bff";

export async function GET(request: Request): Promise<Response> {
  return forwardToErpAdmin({
    request,
    permission: "admin:catalog:view",
    path: "/api/internal/admin/catalog/products",
    method: "GET",
  });
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  return forwardToErpAdmin({
    request,
    permission: "admin:catalog:manage",
    path: "/api/internal/admin/catalog/products",
    method: "POST",
    body,
  });
}
