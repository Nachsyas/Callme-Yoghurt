import { forwardToErpAdmin } from "@/lib/auth/admin-bff";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  return forwardToErpAdmin({
    request,
    permission: "admin:catalog:manage",
    path: `/api/internal/admin/catalog/variants/${encodeURIComponent(id)}/price`,
    method: "POST",
    body,
  });
}
