import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { hasPermission, requirePermission } from '../../src/lib/auth/permissions.ts';
import { adminOrderStore } from '../fixtures/admin-order-store.ts';
import {
  isValidStatusTransition,
  getAllowedNextTransitions,
} from '../../src/lib/order/index.ts';
import type { AdminSession } from '../../src/lib/auth/admin-session.ts';

describe('Phase 1.7C.16 — Admin Order Management & Fulfillment Dashboard', () => {
  beforeEach(() => {
    adminOrderStore.reset();
  });

  describe('Task 8 — Security & RBAC Enforcement', () => {
    it('proves admin orders BFF API route handlers exist', () => {
      const routes = [
        'src/app/api/admin/orders/route.ts',
        'src/app/api/admin/orders/[id]/route.ts',
      ];

      for (const route of routes) {
        const fullPath = path.resolve(process.cwd(), route);
        assert.ok(fs.existsSync(fullPath), `Required BFF route '${route}' must exist`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        assert.ok(
          content.includes('getAdminSessionFromRequest'),
          `Route '${route}' must check session via getAdminSessionFromRequest`
        );
        assert.ok(
          content.includes('requirePermission'),
          `Route '${route}' must check RBAC via requirePermission`
        );
      }
    });

    it('proves order management permissions are strictly enforced by RBAC', () => {
      // OWNER has full access
      assert.equal(hasPermission('OWNER', 'admin:orders:view'), true);
      assert.equal(hasPermission('OWNER', 'admin:orders:manage'), true);

      // ADMIN has operational access
      assert.equal(hasPermission('ADMIN', 'admin:orders:view'), true);
      assert.equal(hasPermission('ADMIN', 'admin:orders:manage'), true);

      // Customer or invalid role fails closed
      assert.equal(hasPermission('CUSTOMER', 'admin:orders:view'), false);
      assert.equal(hasPermission('CUSTOMER', 'admin:orders:manage'), false);
      assert.equal(hasPermission('GUEST', 'admin:orders:view'), false);
      assert.equal(hasPermission('WAREHOUSE_STAFF', 'admin:orders:manage'), false);
    });

    it('validates session context before granting access', () => {
      const ownerSession: AdminSession = {
        user: { id: 'u1', username: 'owner', email: 'owner@test.com', role: 'OWNER' },
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };

      const adminSession: AdminSession = {
        user: { id: 'u2', username: 'admin', email: 'admin@test.com', role: 'ADMIN' },
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };

      assert.equal(requirePermission(ownerSession, 'admin:orders:view'), true);
      assert.equal(requirePermission(ownerSession, 'admin:orders:manage'), true);
      assert.equal(requirePermission(adminSession, 'admin:orders:view'), true);
      assert.equal(requirePermission(adminSession, 'admin:orders:manage'), true);
      assert.equal(requirePermission(null, 'admin:orders:view'), false);
    });
  });

  describe('Task 3 — Status Management & Transition Rules', () => {
    it('allows valid progressive lifecycle transitions', () => {
      assert.equal(isValidStatusTransition('WAITING_PAYMENT', 'PAYMENT_CONFIRMED'), true);
      assert.equal(isValidStatusTransition('PAYMENT_CONFIRMED', 'PROCESSING'), true);
      assert.equal(isValidStatusTransition('PROCESSING', 'READY_TO_SHIP'), true);
      assert.equal(isValidStatusTransition('READY_TO_SHIP', 'DELIVERED'), true);
    });

    it('allows valid cancellations from WAITING_PAYMENT and PROCESSING', () => {
      assert.equal(isValidStatusTransition('WAITING_PAYMENT', 'CANCELLED'), true);
      assert.equal(isValidStatusTransition('PROCESSING', 'CANCELLED'), true);
    });

    it('strictly prevents invalid status transitions', () => {
      // Skipping intermediate states is forbidden
      assert.equal(isValidStatusTransition('WAITING_PAYMENT', 'PROCESSING'), false);
      assert.equal(isValidStatusTransition('WAITING_PAYMENT', 'READY_TO_SHIP'), false);
      assert.equal(isValidStatusTransition('WAITING_PAYMENT', 'DELIVERED'), false);

      // Skipping backwards is forbidden
      assert.equal(isValidStatusTransition('PROCESSING', 'WAITING_PAYMENT'), false);
      assert.equal(isValidStatusTransition('READY_TO_SHIP', 'PROCESSING'), false);

      // Cancellation not allowed from PAYMENT_CONFIRMED or READY_TO_SHIP per Task 3 spec
      assert.equal(isValidStatusTransition('PAYMENT_CONFIRMED', 'CANCELLED'), false);
      assert.equal(isValidStatusTransition('READY_TO_SHIP', 'CANCELLED'), false);

      // Terminal states cannot transition to anything
      assert.equal(isValidStatusTransition('DELIVERED', 'WAITING_PAYMENT'), false);
      assert.equal(isValidStatusTransition('DELIVERED', 'CANCELLED'), false);
      assert.equal(isValidStatusTransition('CANCELLED', 'DELIVERED'), false);
      assert.equal(isValidStatusTransition('CANCELLED', 'WAITING_PAYMENT'), false);
    });

    it('returns exact allowed transitions matching Task 3 requirements', () => {
      assert.deepEqual(getAllowedNextTransitions('WAITING_PAYMENT'), [
        'PAYMENT_CONFIRMED',
        'CANCELLED',
      ]);
      assert.deepEqual(getAllowedNextTransitions('PAYMENT_CONFIRMED'), ['PROCESSING']);
      assert.deepEqual(getAllowedNextTransitions('PROCESSING'), [
        'READY_TO_SHIP',
        'CANCELLED',
      ]);
      assert.deepEqual(getAllowedNextTransitions('READY_TO_SHIP'), ['DELIVERED']);
      assert.deepEqual(getAllowedNextTransitions('DELIVERED'), []);
      assert.deepEqual(getAllowedNextTransitions('CANCELLED'), []);
    });

    it('adminOrderStore.updateOrderStatus rejects invalid transitions and updates valid ones', () => {
      const order = adminOrderStore.getOrderById('CMY-20260926-0001');
      assert.ok(order);
      assert.equal(order.order_status, 'WAITING_PAYMENT');

      // Attempt invalid transition to DELIVERED
      const invalidResult = adminOrderStore.updateOrderStatus(
        'CMY-20260926-0001',
        'DELIVERED'
      );
      assert.equal(invalidResult.success, false);
      assert.ok(invalidResult.error?.includes('tidak valid'));

      // Perform valid transition to PAYMENT_CONFIRMED
      const validResult = adminOrderStore.updateOrderStatus(
        'CMY-20260926-0001',
        'PAYMENT_CONFIRMED',
        'admin_user'
      );
      assert.equal(validResult.success, true);
      assert.equal(validResult.order?.order_status, 'PAYMENT_CONFIRMED');
      assert.equal(validResult.order?.payment.status, 'PAID');
    });
  });

  describe('Task 1 & 2 — Admin Order List & Detail View', () => {
    it('provides required order listing with prompt example CMY-20260926-0001', () => {
      const orders = adminOrderStore.getOrders();
      assert.ok(orders.length >= 5);

      const target = orders.find((o) => o.order_number === 'CMY-20260926-0001');
      assert.ok(target, 'Order CMY-20260926-0001 must exist in store');
      assert.equal(target.customer.name, 'Budi Santoso');
      assert.equal(target.customer.whatsapp, '08123456789');
      assert.equal(target.payment.status, 'PENDING_PAYMENT');
      assert.equal(target.order_status, 'WAITING_PAYMENT');
      assert.equal(target.cost.total_amount, 55000);
    });

    it('provides complete order detail structure: customer, items, cost breakdown, payment', () => {
      const order = adminOrderStore.getOrderById('CMY-20260926-0001');
      assert.ok(order);

      // Customer section
      assert.ok(order.customer.name);
      assert.ok(order.customer.whatsapp);
      assert.ok(order.customer.address);

      // Items section
      assert.ok(Array.isArray(order.items));
      assert.ok(order.items.length > 0);
      assert.ok(order.items[0].product_name);
      assert.ok(order.items[0].variant);
      assert.ok(order.items[0].quantity > 0);
      assert.ok(order.items[0].price > 0);

      // Cost section
      assert.equal(typeof order.cost.subtotal, 'number');
      assert.equal(typeof order.cost.shipping_fee, 'number');
      assert.equal(typeof order.cost.cold_chain_fee, 'number');
      assert.equal(
        order.cost.total_amount,
        order.cost.subtotal + order.cost.shipping_fee + order.cost.cold_chain_fee
      );

      // Payment section
      assert.ok(order.payment.method);
      assert.ok(order.payment.status);
    });
  });

  describe('Task 4 — Payment Verification Preparation', () => {
    it('confirms payment proof and transitions WAITING_PAYMENT to PAYMENT_CONFIRMED', () => {
      const result = adminOrderStore.verifyPayment(
        'CMY-20260926-0001',
        'confirm',
        'admin_approver'
      );
      assert.equal(result.success, true);
      assert.equal(result.order?.payment.status, 'PAID');
      assert.equal(result.order?.payment.proof_status, 'verified');
      assert.equal(result.order?.order_status, 'PAYMENT_CONFIRMED');
      assert.ok(result.order?.payment.verified_at);
    });

    it('rejects payment proof and sets status to FAILED', () => {
      const result = adminOrderStore.verifyPayment(
        'CMY-20260926-0001',
        'reject',
        'admin_approver'
      );
      assert.equal(result.success, true);
      assert.equal(result.order?.payment.status, 'FAILED');
      assert.equal(result.order?.payment.proof_status, 'rejected');
    });
  });

  describe('Task 5 — Order Filtering', () => {
    it('filters orders by all required status tabs', () => {
      const allOrders = adminOrderStore.getOrders({ status: 'ALL' });
      assert.ok(allOrders.length >= 5);

      const waiting = adminOrderStore.getOrders({ status: 'WAITING_PAYMENT' });
      assert.ok(waiting.every((o) => o.order_status === 'WAITING_PAYMENT'));

      const processing = adminOrderStore.getOrders({ status: 'PROCESSING' });
      assert.ok(processing.every((o) => o.order_status === 'PROCESSING'));

      const readyToShip = adminOrderStore.getOrders({ status: 'READY_TO_SHIP' });
      assert.ok(readyToShip.every((o) => o.order_status === 'READY_TO_SHIP'));

      const delivered = adminOrderStore.getOrders({ status: 'DELIVERED' });
      assert.ok(delivered.every((o) => o.order_status === 'DELIVERED'));

      const cancelled = adminOrderStore.getOrders({ status: 'CANCELLED' });
      assert.ok(cancelled.every((o) => o.order_status === 'CANCELLED'));
    });

    it('filters orders by search query across order number, name, and phone', () => {
      const byNumber = adminOrderStore.getOrders({ search: 'CMY-20260926-0001' });
      assert.equal(byNumber.length, 1);
      assert.equal(byNumber[0].customer.name, 'Budi Santoso');

      const byName = adminOrderStore.getOrders({ search: 'Santoso' });
      assert.equal(byName.length, 1);
      assert.equal(byName[0].order_number, 'CMY-20260926-0001');

      const byPhone = adminOrderStore.getOrders({ search: '08123456789' });
      assert.equal(byPhone.length, 1);
    });
  });

  describe('Task 6 — Dashboard Summary Cards', () => {
    it('computes accurate counts for all 5 summary metric cards', () => {
      const metrics = adminOrderStore.getDashboardMetrics();

      assert.equal(typeof metrics.today_orders, 'number');
      assert.ok(metrics.today_orders >= 1, "Today's Orders must be counted");

      assert.equal(typeof metrics.waiting_payment, 'number');
      assert.ok(metrics.waiting_payment >= 1, 'Waiting payment count must be present');

      assert.equal(typeof metrics.processing, 'number');
      assert.ok(metrics.processing >= 1, 'Processing count must be present');

      assert.equal(typeof metrics.ready_to_ship, 'number');
      assert.ok(metrics.ready_to_ship >= 1, 'Ready to ship count must be present');

      assert.equal(typeof metrics.completed_orders, 'number');
      assert.ok(metrics.completed_orders >= 1, 'Completed orders count must be present');

      assert.ok(metrics.total_revenue > 0, 'Total revenue must be non-negative');
    });
  });
});
