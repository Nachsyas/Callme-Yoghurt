import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_LIFECYCLE_STATUSES,
  isValidStatusTransition,
  resolveOrderLifecycleStatus,
  generateHumanOrderNumber,
  isValidOrderNumber,
  buildOrderSummary,
  generateDigitalReceipt,
  generateWhatsAppReceipt,
  saveOrderSummary,
  getOrderSummary,
  clearOrderSummary,
  type OrderSummary,
} from '../../src/lib/order/index.ts';

class MockStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

describe('Phase 1.7C.15 — Order Management & Receipt Foundation', () => {
  describe('Task 1 — Order Status Lifecycle', () => {
    it('proves exactly 6 defined order lifecycle statuses exist', () => {
      assert.equal(ORDER_LIFECYCLE_STATUSES.length, 6);
      assert.deepEqual([...ORDER_LIFECYCLE_STATUSES], [
        'WAITING_PAYMENT',
        'PAYMENT_CONFIRMED',
        'PROCESSING',
        'READY_TO_SHIP',
        'DELIVERED',
        'CANCELLED',
      ]);
    });

    it('proves valid lifecycle status transitions', () => {
      assert.equal(isValidStatusTransition('WAITING_PAYMENT', 'PAYMENT_CONFIRMED'), true);
      assert.equal(isValidStatusTransition('WAITING_PAYMENT', 'CANCELLED'), true);
      assert.equal(isValidStatusTransition('PAYMENT_CONFIRMED', 'PROCESSING'), true);
      assert.equal(isValidStatusTransition('PROCESSING', 'READY_TO_SHIP'), true);
      assert.equal(isValidStatusTransition('READY_TO_SHIP', 'DELIVERED'), true);
      assert.equal(isValidStatusTransition('DELIVERED', 'WAITING_PAYMENT'), false);
      assert.equal(isValidStatusTransition('CANCELLED', 'WAITING_PAYMENT'), false);
    });

    it('resolves order lifecycle status seamlessly from ERP and payment states', () => {
      assert.equal(resolveOrderLifecycleStatus('CONFIRMED', 'PENDING_PAYMENT'), 'WAITING_PAYMENT');
      assert.equal(resolveOrderLifecycleStatus('CONFIRMED', 'PAID'), 'PAYMENT_CONFIRMED');
      assert.equal(resolveOrderLifecycleStatus('CANCELLED', 'PENDING_PAYMENT'), 'CANCELLED');
      assert.equal(resolveOrderLifecycleStatus('CONFIRMED', 'EXPIRED'), 'CANCELLED');
      assert.equal(resolveOrderLifecycleStatus('CONFIRMED', 'FAILED'), 'CANCELLED');
      assert.equal(resolveOrderLifecycleStatus('DONE'), 'DELIVERED');
    });
  });

  describe('Task 2 — Order Number Generation', () => {
    it('generates human-readable order number with date and sequence (e.g. CMY-20260926-0001)', () => {
      const fixedDate = new Date(2026, 8, 26); // September 26, 2026
      const orderNum = generateHumanOrderNumber({ date: fixedDate, sequence: 1 });
      assert.equal(orderNum, 'CMY-20260926-0001');
    });

    it('generates unique, collision-resistant order numbers when sequence is omitted', () => {
      const set = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const num = generateHumanOrderNumber();
        assert.equal(set.has(num), false, 'Order numbers must be unique');
        set.add(num);
        assert.ok(isValidOrderNumber(num), `Order number ${num} must be valid`);
      }
    });

    it('validates human-readable and legacy order number patterns', () => {
      assert.equal(isValidOrderNumber('CMY-20260926-0001'), true);
      assert.equal(isValidOrderNumber('CY-2026-0001'), true);
      assert.equal(isValidOrderNumber('CY-20260926-01JABCDEF12345'), true);
      assert.equal(isValidOrderNumber('invalid'), false);
      assert.equal(isValidOrderNumber(12345 as unknown as string), false);
    });
  });

  describe('Task 3 — Order Summary Object Structure', () => {
    it('constructs a verified, type-safe order summary object', () => {
      const summary = buildOrderSummary({
        order_number: 'CMY-20260926-0001',
        customer_name: 'Budi Santoso',
        whatsapp_number: '08123456789',
        items: [
          {
            product_name: 'Plain Pure Original',
            variant: '500ml',
            quantity: 2,
            price: 30000,
          },
        ],
        subtotal: 60000,
        shipping_fee: 20000,
        cold_chain_fee: 5000,
        total_amount: 85000,
        payment_status: 'PENDING_PAYMENT',
        order_status: 'WAITING_PAYMENT',
      });

      assert.equal(summary.order_number, 'CMY-20260926-0001');
      assert.equal(summary.customer_name, 'Budi Santoso');
      assert.equal(summary.whatsapp_number, '628123456789');
      assert.equal(summary.subtotal, 60000);
      assert.equal(summary.shipping_fee, 20000);
      assert.equal(summary.cold_chain_fee, 5000);
      assert.equal(summary.total_amount, 85000);
      assert.equal(summary.items.length, 1);
      assert.equal(summary.items[0].product_name, 'Plain Pure Original');
      assert.equal(summary.payment_status, 'PENDING_PAYMENT');
      assert.equal(summary.order_status, 'WAITING_PAYMENT');
    });

    it('rejects incomplete or invalid order summary input', () => {
      assert.throws(() => {
        buildOrderSummary({
          order_number: '',
          customer_name: 'Budi',
          whatsapp_number: '08123456789',
          items: [{ product_name: 'P', variant: 'V', quantity: 1, price: 10000 }],
          subtotal: 10000,
          shipping_fee: 0,
          cold_chain_fee: 0,
        });
      }, /Order number is required/);

      assert.throws(() => {
        buildOrderSummary({
          order_number: 'CMY-1',
          customer_name: 'Budi',
          whatsapp_number: '08123456789',
          items: [],
          subtotal: 0,
          shipping_fee: 0,
          cold_chain_fee: 0,
        });
      }, /requires at least one line item/);
    });
  });

  describe('Task 4 — Digital Receipt Generation', () => {
    it('generates digital receipt text adhering strictly to format specifications', () => {
      const summary: OrderSummary = {
        order_number: 'CMY-20260926-0001',
        customer_name: 'Budi Santoso',
        whatsapp_number: '628123456789',
        items: [
          {
            product_name: 'Plain Pure Original',
            variant: '500ml',
            quantity: 2,
            price: 30000,
          },
        ],
        subtotal: 60000,
        shipping_fee: 20000,
        cold_chain_fee: 5000,
        total_amount: 85000,
        payment_status: 'PENDING_PAYMENT',
        order_status: 'WAITING_PAYMENT',
      };

      const receipt = generateDigitalReceipt(summary);

      assert.ok(receipt.includes('CALLME YOGHURT'));
      assert.ok(receipt.includes('Order:\nCMY-20260926-0001'));
      assert.ok(receipt.includes('Customer:\nBudi Santoso'));
      assert.ok(receipt.includes('Plain Pure Original\n500ml x2'));
      assert.ok(receipt.includes('Subtotal:\nRp60.000'));
      assert.ok(receipt.includes('Shipping:\nRp20.000'));
      assert.ok(receipt.includes('Cold Chain:\nRp5.000'));
      assert.ok(receipt.includes('TOTAL:\nRp85.000'));
    });
  });

  describe('Task 5 — WhatsApp Receipt Foundation', () => {
    it('generates valid wa.me URL with normalized phone number and encoded receipt message', () => {
      const summary: OrderSummary = {
        order_number: 'CMY-20260926-0001',
        customer_name: 'Budi Santoso',
        whatsapp_number: '628123456789',
        items: [
          {
            product_name: 'Plain Pure Original',
            variant: '500ml',
            quantity: 2,
            price: 30000,
          },
        ],
        subtotal: 60000,
        shipping_fee: 20000,
        cold_chain_fee: 5000,
        total_amount: 85000,
        payment_status: 'PENDING_PAYMENT',
        order_status: 'WAITING_PAYMENT',
      };

      const result = generateWhatsAppReceipt({
        phoneNumber: '08123456789',
        orderSummary: summary,
      });

      assert.equal(result.phoneNumber, '628123456789');
      assert.ok(result.url.startsWith('https://wa.me/628123456789?text='));
      assert.ok(result.rawMessage.includes('CMY-20260926-0001'));
      assert.ok(result.rawMessage.includes('Rp85.000'));
      assert.ok(result.rawMessage.includes('Cold Chain Logistics'));
      assert.equal(result.encodedMessage, encodeURIComponent(result.rawMessage));
    });
  });

  describe('Task 7 — Security & Client Storage Isolation', () => {
    it('persists and retrieves order summary without database IDs or secret keys', () => {
      const storage = new MockStorage();
      const summary: OrderSummary = {
        order_number: 'CMY-20260926-0001',
        customer_name: 'Budi Santoso',
        whatsapp_number: '628123456789',
        items: [
          {
            product_name: 'Plain Pure Original',
            variant: '500ml',
            quantity: 2,
            price: 30000,
          },
        ],
        subtotal: 60000,
        shipping_fee: 20000,
        cold_chain_fee: 5000,
        total_amount: 85000,
        payment_status: 'PENDING_PAYMENT',
        order_status: 'WAITING_PAYMENT',
      };

      const saved = saveOrderSummary(summary, storage);
      assert.equal(saved, true);

      const raw = storage.getItem('callme.order.summary.v1');
      assert.ok(raw);
      // Zero-Trust security checks
      assert.equal(raw.includes('secret'), false, 'Never persist secret keys');
      assert.equal(raw.includes('customer_id'), false, 'Never persist internal database UUID customer_id');
      assert.equal(raw.includes('order_id'), false, 'Order summary uses public order_number only');

      const retrieved = getOrderSummary('CMY-20260926-0001', storage);
      assert.ok(retrieved);
      assert.equal(retrieved.order_number, 'CMY-20260926-0001');
      assert.equal(retrieved.total_amount, 85000);

      // Retrieval with mismatching order number fails closed
      assert.equal(getOrderSummary('CMY-DIFFERENT', storage), null);

      clearOrderSummary(storage);
      assert.equal(storage.getItem('callme.order.summary.v1'), null);
    });
  });
});
