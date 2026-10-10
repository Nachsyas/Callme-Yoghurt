import { forwardToErpAdmin } from "@/lib/auth/admin-bff";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("item_id");
  const query = itemId ? `?item_id=${encodeURIComponent(itemId)}` : "";

  return forwardToErpAdmin({
    request,
    permission: "admin:inventory:view",
    path: `/api/internal/admin/inventory/lots${query}`,
    method: "GET",
  });
}
