import { forwardToErpAdmin } from "@/lib/auth/admin-bff";

export async function GET(request: Request): Promise<Response> {
  return forwardToErpAdmin({
    request,
    permission: "admin:inventory:view",
    path: "/api/internal/admin/inventory/meta",
    method: "GET",
  });
}
