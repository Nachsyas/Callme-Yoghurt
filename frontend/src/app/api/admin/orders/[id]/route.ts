import { forwardToErpAdmin } from '@/lib/auth/admin-bff.ts';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session.ts';
import { requirePermission } from '@/lib/auth/permissions.ts';
import { NextResponse } from 'next/server.js';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: active admin session required' },
      { status: 401 }
    );
  }

  if (!requirePermission(session, 'admin:orders:view')) {
    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions for viewing order details' },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  return forwardToErpAdmin({
    request,
    permission: 'admin:orders:view',
    path: `/api/internal/admin/orders/${encodeURIComponent(id)}`,
    method: 'GET',
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<Response> {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: active admin session required' },
      { status: 401 }
    );
  }

  if (!requirePermission(session, 'admin:orders:manage')) {
    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions for managing orders' },
      { status: 403 }
    );
  }

  // Manual admin order status and payment verification mutations are not implemented in ERP domain (Phase 1.7C.20)
  return NextResponse.json(
    { error: 'BLOCKED: Authoritative ERP order status and payment verification mutations are not implemented in backend core' },
    { status: 501 }
  );
}
