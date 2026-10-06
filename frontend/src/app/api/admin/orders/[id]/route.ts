import { NextResponse } from 'next/server.js';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { adminOrderStore } from '@/lib/order/admin-order-store';
import type { OrderLifecycleStatus } from '@/lib/order/types';

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
  const order = adminOrderStore.getOrderById(id);

  if (!order) {
    return NextResponse.json(
      { error: 'Pesanan tidak ditemukan' },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { success: true, order },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
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

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;

  // Handle Task 4: Payment verification actions
  if (payload.action === 'confirm_payment' || payload.action === 'reject_payment') {
    const action = payload.action === 'confirm_payment' ? 'confirm' : 'reject';
    const result = adminOrderStore.verifyPayment(id, action, session.user.username);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({ success: true, order: result.order }, { status: 200 });
  }

  // Handle Task 3: Order status transitions
  if (typeof payload.status === 'string') {
    const targetStatus = payload.status as OrderLifecycleStatus;
    const result = adminOrderStore.updateOrderStatus(
      id,
      targetStatus,
      session.user.username
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Transisi status tidak diizinkan' },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, order: result.order }, { status: 200 });
  }

  return NextResponse.json(
    { error: 'Permintaan tidak valid: tentukan status atau aksi pembayaran' },
    { status: 400 }
  );
}
