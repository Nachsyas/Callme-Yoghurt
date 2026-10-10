import { forwardToErpAdmin } from "@/lib/auth/admin-bff";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  return forwardToErpAdmin({
    request,
    permission: "admin:inventory:manage",
    path: "/api/internal/admin/inventory/receipts",
    method: "POST",
    body,
  });
}
