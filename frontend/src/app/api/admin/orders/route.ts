import { forwardToErpAdmin } from '@/lib/auth/admin-bff.ts';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session.ts';
import { requirePermission } from '@/lib/auth/permissions.ts';
import { NextResponse } from 'next/server.js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  // 1. Session verification
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: active admin session required' },
      { status: 401 }
    );
  }

  // 2. RBAC permission check
  if (!requirePermission(session, 'admin:orders:view')) {
    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions for viewing orders' },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const query = url.searchParams.toString();
  const path = `/api/internal/admin/orders${query ? `?${query}` : ''}`;

  return forwardToErpAdmin({
    request,
    permission: 'admin:orders:view',
    path,
    method: 'GET',
  });
}

export async function POST(request: Request): Promise<Response> {
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

  // Manual admin order creation mutation is not implemented in ERP domain (Phase 1.7C.20)
  return NextResponse.json(
    { error: 'BLOCKED: Authoritative ERP order creation mutation is unavailable for manual admin creation' },
    { status: 501 }
  );
}
