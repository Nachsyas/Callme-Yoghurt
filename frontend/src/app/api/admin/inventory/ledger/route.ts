import { forwardToErpAdmin } from "@/lib/auth/admin-bff";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("item_id") || searchParams.get("inventory_item_id");
  const warehouseId = searchParams.get("warehouse_id") || searchParams.get("warehouse_code");
  const limit = searchParams.get("limit") || "100";

  const params = new URLSearchParams();
  if (itemId) params.set("item_id", itemId);
  if (warehouseId) params.set("warehouse_id", warehouseId);
  params.set("limit", limit);

  return forwardToErpAdmin({
    request,
    permission: "admin:inventory:view",
    path: `/api/internal/admin/inventory/ledger?${params.toString()}`,
    method: "GET",
  });
}
