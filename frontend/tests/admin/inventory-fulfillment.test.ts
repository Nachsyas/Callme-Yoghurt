import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { adminOrderStore } from '../fixtures/admin-order-store.ts';

describe('Phase 1.7C.17 — Order Fulfillment & Inventory Integration Foundation', () => {
  beforeEach(() => {
    adminOrderStore.reset();
  });

  describe('Scenario 1: Stock 10, Order 2, Payment Confirm -> Reserved 2', () => {
    it('successfully reserves 2 units when stock is 10 and order quantity is 2', () => {
      // Setup stock: On hand 10, reserved 0, available 10
      adminOrderStore.setStock('Plain Pure Original', '500ml', 10, 0);
      const stockBefore = adminOrderStore.getStock('Plain Pure Original', '500ml');
      assert.equal(stockBefore?.on_hand, 10);
      assert.equal(stockBefore?.reserved, 0);
      assert.equal(stockBefore?.available, 10);

      // Create order with 2 units of Plain Pure Original 500ml
      const order = adminOrderStore.addOrder({
        order_number: 'CMY-TEST-0001',
        order_status: 'WAITING_PAYMENT',
        items: [
          {
            product_name: 'Plain Pure Original',
            variant: '500ml',
            quantity: 2,
            price: 15000,
          },
        ],
      });

      // Confirm payment (Task 1 & 4)
      const result = adminOrderStore.updateOrderStatus(order.id, 'PAYMENT_CONFIRMED', 'admin_staff');
      assert.equal(result.success, true);
      assert.equal(result.order?.order_status, 'PAYMENT_CONFIRMED');

      // Verify Inventory Reservation Status & Quantity (Task 1, 3, 5)
      assert.equal(result.order?.inventory.status, 'RESERVED');
      assert.equal(result.order?.inventory.summary_status, 'READY');
      assert.equal(result.order?.inventory.items[0].reserved_quantity, 2);
      assert.equal(result.order?.inventory.items[0].status, 'RESERVED');

      // Verify stock in store has reserved 2 and available reduced to 8
      const stockAfter = adminOrderStore.getStock('Plain Pure Original', '500ml');
      assert.equal(stockAfter?.on_hand, 10);
      assert.equal(stockAfter?.reserved, 2);
      assert.equal(stockAfter?.available, 8);

      // Verify Audit Log includes ORDER_PAYMENT_CONFIRMED and INVENTORY_RESERVED (Task 6)
      const logs = result.order?.audit_logs || [];
      assert.ok(logs.some((l) => l.event_type === 'ORDER_PAYMENT_CONFIRMED'));
      assert.ok(logs.some((l) => l.event_type === 'INVENTORY_RESERVED'));
    });

    it('successfully confirms payment via verifyPayment action and reserves stock', () => {
      adminOrderStore.setStock('Plain Pure Original', '500ml', 10, 0);
      const order = adminOrderStore.addOrder({
        order_number: 'CMY-TEST-VP-0001',
        order_status: 'WAITING_PAYMENT',
        items: [
          {
            product_name: 'Plain Pure Original',
            variant: '500ml',
            quantity: 2,
            price: 15000,
          },
        ],
      });

      const result = adminOrderStore.verifyPayment(order.id, 'confirm', 'finance_admin');
      assert.equal(result.success, true);
      assert.equal(result.order?.payment.status, 'PAID');
      assert.equal(result.order?.order_status, 'PAYMENT_CONFIRMED');
      assert.equal(result.order?.inventory.status, 'RESERVED');
      assert.equal(result.order?.inventory.items[0].reserved_quantity, 2);
    });
  });

  describe('Scenario 2: Stock 1, Order 2, Payment Confirm -> Rejected (Insufficient stock)', () => {
    it('rejects payment confirmation when available stock (1) is less than requested quantity (2)', () => {
      // Setup stock: On hand 1, reserved 0, available 1
      adminOrderStore.setStock('Plain Pure Original', '500ml', 1, 0);
      const stockBefore = adminOrderStore.getStock('Plain Pure Original', '500ml');
      assert.equal(stockBefore?.available, 1);

      // Create order with 2 units of Plain Pure Original 500ml
      const order = adminOrderStore.addOrder({
        order_number: 'CMY-TEST-INSUF-0001',
        order_status: 'WAITING_PAYMENT',
        items: [
          {
            product_name: 'Plain Pure Original',
            variant: '500ml',
            quantity: 2,
            price: 15000,
          },
        ],
      });

      // Confirm payment attempt -> MUST BE REJECTED (Task 2)
      const result = adminOrderStore.updateOrderStatus(order.id, 'PAYMENT_CONFIRMED');
      assert.equal(result.success, false);
      assert.ok(
        result.error?.includes('Stok tidak mencukupi'),
        `Error must mention insufficient stock: ${result.error}`
      );
      assert.ok(result.error?.includes('Diminta: 2'));
      assert.ok(result.error?.includes('Tersedia: 1'));

      // Verify order status was NOT changed
      const orderAfter = adminOrderStore.getOrderById(order.id);
      assert.equal(orderAfter?.order_status, 'WAITING_PAYMENT');
      assert.equal(orderAfter?.inventory.status, 'AVAILABLE');

      // Verify stock was not touched
      const stockAfter = adminOrderStore.getStock('Plain Pure Original', '500ml');
      assert.equal(stockAfter?.reserved, 0);
      assert.equal(stockAfter?.available, 1);
    });

    it('rejects verifyPayment when available stock is insufficient', () => {
      adminOrderStore.setStock('Plain Pure Original', '500ml', 1, 0);
      const order = adminOrderStore.addOrder({
        order_number: 'CMY-TEST-INSUF-0002',
        order_status: 'WAITING_PAYMENT',
        items: [
          {
            product_name: 'Plain Pure Original',
            variant: '500ml',
            quantity: 2,
            price: 15000,
          },
        ],
      });

      const result = adminOrderStore.verifyPayment(order.id, 'confirm');
      assert.equal(result.success, false);
      assert.ok(result.error?.includes('Stok tidak mencukupi'));
    });
  });

  describe('Scenario 3: Cancel order -> Reserved stock released', () => {
    it('releases reserved stock back to available when an order is cancelled', () => {
      // Setup stock: On hand 10, reserved 0, available 10
      adminOrderStore.setStock('Plain Pure Original', '500ml', 10, 0);

      // Create order and confirm payment (stock reserved: 2, available: 8)
      const order = adminOrderStore.addOrder({
        order_number: 'CMY-TEST-CANCEL-0001',
        order_status: 'WAITING_PAYMENT',
        items: [
          {
            product_name: 'Plain Pure Original',
            variant: '500ml',
            quantity: 2,
            price: 15000,
          },
        ],
      });

      const confirmRes = adminOrderStore.updateOrderStatus(order.id, 'PAYMENT_CONFIRMED');
      assert.equal(confirmRes.success, true);
      assert.equal(confirmRes.order?.inventory.status, 'RESERVED');

      let stock = adminOrderStore.getStock('Plain Pure Original', '500ml');
      assert.equal(stock?.reserved, 2);
      assert.equal(stock?.available, 8);

      // Move to PROCESSING (Task 4)
      const procRes = adminOrderStore.updateOrderStatus(order.id, 'PROCESSING');
      assert.equal(procRes.success, true);
      assert.ok(procRes.order?.audit_logs.some((l) => l.event_type === 'ORDER_PROCESSING'));

      // Cancel order (Scenario 3 & Task 3: RESERVED -> RELEASED)
      const cancelRes = adminOrderStore.updateOrderStatus(order.id, 'CANCELLED', 'customer_service');
      assert.equal(cancelRes.success, true);
      assert.equal(cancelRes.order?.order_status, 'CANCELLED');
      assert.equal(cancelRes.order?.inventory.status, 'RELEASED');
      assert.equal(cancelRes.order?.inventory.summary_status, 'RELEASED');
      assert.ok(cancelRes.order?.inventory.released_at);

      // Verify stock was restored
      stock = adminOrderStore.getStock('Plain Pure Original', '500ml');
      assert.equal(stock?.on_hand, 10);
      assert.equal(stock?.reserved, 0, 'Reserved stock must be 0 after cancellation release');
      assert.equal(stock?.available, 10, 'Available stock must return to 10');

      // Verify INVENTORY_RELEASED audit log
      assert.ok(
        cancelRes.order?.audit_logs.some((l) => l.event_type === 'INVENTORY_RELEASED'),
        'Audit log must record INVENTORY_RELEASED'
      );
    });
  });

  describe('Task 3 & 4 — End-to-End Fulfillment Lifecycle Flow', () => {
    it('transitions AVAILABLE -> RESERVED -> FULFILLED on READY_TO_SHIP dispatch', () => {
      adminOrderStore.setStock('Plain Pure Original', '500ml', 10, 0);

      const order = adminOrderStore.addOrder({
        order_number: 'CMY-TEST-FLOW-0001',
        order_status: 'WAITING_PAYMENT',
        items: [
          {
            product_name: 'Plain Pure Original',
            variant: '500ml',
            quantity: 2,
            price: 15000,
          },
        ],
      });

      // 1. Initial State: AVAILABLE
      assert.equal(order.inventory.status, 'AVAILABLE');

      // 2. PAYMENT_CONFIRMED -> RESERVED
      const res1 = adminOrderStore.updateOrderStatus(order.id, 'PAYMENT_CONFIRMED');
      assert.equal(res1.order?.inventory.status, 'RESERVED');
      assert.equal(res1.order?.inventory.summary_status, 'READY');

      // 3. PROCESSING -> Prepare fulfillment
      const res2 = adminOrderStore.updateOrderStatus(order.id, 'PROCESSING');
      assert.equal(res2.order?.order_status, 'PROCESSING');
      assert.equal(res2.order?.inventory.status, 'RESERVED');

      // 4. READY_TO_SHIP -> Stock fulfillment completed
      const res3 = adminOrderStore.updateOrderStatus(order.id, 'READY_TO_SHIP');
      assert.equal(res3.order?.order_status, 'READY_TO_SHIP');
      assert.equal(res3.order?.inventory.status, 'FULFILLED');
      assert.equal(res3.order?.inventory.summary_status, 'FULFILLED');
      assert.ok(res3.order?.inventory.fulfilled_at);

      // Verify final stock: on_hand reduced from 10 to 8, reserved cleared to 0
      const stock = adminOrderStore.getStock('Plain Pure Original', '500ml');
      assert.equal(stock?.on_hand, 8);
      assert.equal(stock?.reserved, 0);
      assert.equal(stock?.available, 8);

      // 5. Audit Log integrity: Check all required events exist
      const logs = res3.order?.audit_logs || [];
      const types = logs.map((l) => l.event_type);
      assert.ok(types.includes('ORDER_PAYMENT_CONFIRMED'));
      assert.ok(types.includes('INVENTORY_RESERVED'));
      assert.ok(types.includes('ORDER_PROCESSING'));
      assert.ok(types.includes('ORDER_READY_TO_SHIP'));
    });
  });

  describe('Task 6 — Audit Log Permanence & Immutability', () => {
    it('never deletes history: sequential transitions preserve all previous log entries', () => {
      adminOrderStore.setStock('Plain Pure Original', '500ml', 10, 0);

      const order = adminOrderStore.addOrder({
        order_number: 'CMY-TEST-AUDIT-0001',
        order_status: 'WAITING_PAYMENT',
        items: [
          {
            product_name: 'Plain Pure Original',
            variant: '500ml',
            quantity: 2,
            price: 15000,
          },
        ],
      });

      adminOrderStore.updateOrderStatus(order.id, 'PAYMENT_CONFIRMED');
      adminOrderStore.updateOrderStatus(order.id, 'PROCESSING');
      const finalRes = adminOrderStore.updateOrderStatus(order.id, 'READY_TO_SHIP');

      const logs = finalRes.order?.audit_logs || [];
      assert.ok(logs.length >= 4);

      // Check timestamps are strictly chronological
      for (let i = 1; i < logs.length; i++) {
        const prevTime = new Date(logs[i - 1].timestamp).getTime();
        const currTime = new Date(logs[i].timestamp).getTime();
        assert.ok(currTime >= prevTime, 'Logs must be append-only chronological');
      }
    });
  });

  describe('Task 7 — Security & Zero Negative Stock', () => {
    it('strictly rejects negative on_hand or reserved values in setStock', () => {
      assert.throws(
        () => adminOrderStore.setStock('Plain Pure Original', '500ml', -5, 0),
        /Negative stock values are strictly prohibited/
      );
      assert.throws(
        () => adminOrderStore.setStock('Plain Pure Original', '500ml', 10, -2),
        /Negative stock values are strictly prohibited/
      );
    });

    it('rejects order with non-positive or negative quantity during availability check', () => {
      const check = adminOrderStore.checkStockAvailability([
        {
          product_name: 'Plain Pure Original',
          variant: '500ml',
          quantity: -1,
          price: 15000,
        },
      ]);
      assert.equal(check.available, false);
    });
  });
});
