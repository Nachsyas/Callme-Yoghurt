import { NextResponse } from 'next/server.js';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { adminOrderStore } from '@/lib/order/admin-order-store';

export async function GET(request: Request): Promise<Response> {
  // 1. Session verification
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: active admin session required' },
      { status: 401 }
    );
  }

  // 2. RBAC permission check (Task 8)
  if (!requirePermission(session, 'admin:orders:view')) {
    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions for viewing orders' },
      { status: 403 }
    );
  }

  // 3. Query filters
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || undefined;
  const search = url.searchParams.get('search') || undefined;

  const orders = adminOrderStore.getOrders({ status, search });
  const metrics = adminOrderStore.getDashboardMetrics();

  return NextResponse.json(
    {
      success: true,
      orders,
      metrics,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
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
      { error: 'Forbidden: insufficient permissions for creating orders' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const order = adminOrderStore.addOrder(body as Parameters<typeof adminOrderStore.addOrder>[0]);

  return NextResponse.json({ success: true, order }, { status: 201 });
}
