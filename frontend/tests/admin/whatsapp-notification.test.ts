import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { adminOrderStore } from '../fixtures/admin-order-store.ts';
import {
  ManualWhatsAppProvider,
  WhatsAppBusinessApiProvider,
  TwilioWhatsAppProvider,
  WatiWhatsAppProvider,
  QontakWhatsAppProvider,
  validateWhatsAppNumber,
} from '../../src/lib/notification/whatsapp-provider.ts';
import {
  generateWhatsAppMessage,
} from '../../src/lib/notification/templates.ts';
import type { NotificationContext } from '../../src/lib/notification/types.ts';

describe('Phase 1.7C.18 — WhatsApp Notification Foundation', () => {
  beforeEach(() => {
    adminOrderStore.reset();
  });

  describe('Task 3 & 4: ManualWhatsAppProvider & Message Generator', () => {
    const mockContext: NotificationContext = {
      event: 'ORDER_CREATED',
      order_number: 'CMY-20260927-0099',
      customer_name: 'Budi Santoso',
      recipient_phone: '0812-3456-7890',
      items: [
        {
          product_name: 'Plain Pure Original',
          variant: '500ml',
          quantity: 2,
          price: 35000,
        },
      ],
      total: 70000,
      status: 'WAITING_PAYMENT',
    };

    it('generates a well-formatted WhatsApp message for ORDER_CREATED', () => {
      const msg = generateWhatsAppMessage(mockContext);
      assert.ok(msg.includes('Budi Santoso'));
      assert.ok(msg.includes('CMY-20260927-0099'));
      assert.ok(msg.includes('Plain Pure Original (500ml) x2'));
      assert.ok(msg.includes('Rp70.000'));
      assert.ok(msg.includes('WAITING_PAYMENT'));
      assert.ok(msg.includes('Cold Chain'));
    });

    it('generates valid wa.me URL without automatically sending', async () => {
      const provider = new ManualWhatsAppProvider();
      const result = await provider.sendMessage(mockContext);

      assert.equal(result.success, true);
      assert.equal(result.provider, 'manual_whatsapp');
      assert.equal(result.status, 'GENERATED');
      assert.ok(result.wa_link?.startsWith('https://wa.me/6281234567890?text='));

      // Validate URL components
      const url = new URL(result.wa_link!);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, 'wa.me');
      assert.equal(url.pathname, '/6281234567890');
      const textParam = url.searchParams.get('text');
      assert.ok(textParam?.includes('CMY-20260927-0099'));
    });

    it('validates and normalizes Indonesian phone numbers correctly', () => {
      assert.equal(validateWhatsAppNumber('081234567890').normalizedPhone, '6281234567890');
      assert.equal(validateWhatsAppNumber('+6281234567890').normalizedPhone, '6281234567890');
      assert.equal(validateWhatsAppNumber('6281234567890').normalizedPhone, '6281234567890');
      assert.equal(validateWhatsAppNumber('0812-3456-7890').normalizedPhone, '6281234567890');

      assert.equal(validateWhatsAppNumber('12345').valid, false);
      assert.equal(validateWhatsAppNumber('abc').valid, false);
      assert.equal(validateWhatsAppNumber('').valid, false);
    });
  });

  describe('Task 5: Future WhatsApp Providers Interface', () => {
    it('verifies all future providers implement WhatsAppProvider interface', async () => {
      const providers = [
        new WhatsAppBusinessApiProvider(),
        new TwilioWhatsAppProvider(),
        new WatiWhatsAppProvider(),
        new QontakWhatsAppProvider(),
      ];

      for (const p of providers) {
        assert.equal(typeof p.sendMessage, 'function');
        assert.equal(typeof p.validateNumber, 'function');

        const validation = p.validateNumber('081234567890');
        assert.equal(validation.valid, true);

        const sendResult = await p.sendMessage({
          event: 'PAYMENT_CONFIRMED',
          order_number: 'CMY-FUTURE-01',
          customer_name: 'Test Customer',
          recipient_phone: '081234567890',
          items: [],
          total: 50000,
          status: 'PAYMENT_CONFIRMED',
        });
        assert.equal(sendResult.status, 'GENERATED');
        assert.ok(sendResult.message.length > 0);
      }
    });
  });

  describe('Task 6: Connect Order Lifecycle Events to Notifications', () => {
    it('generates notification for ORDER_CREATED event', () => {
      const order = adminOrderStore.addOrder({
        order_number: 'CMY-NOTIF-0001',
        order_status: 'WAITING_PAYMENT',
        customer: {
          name: 'Dewi Lestari',
          whatsapp: '081987654321',
          address: 'Jl. Merdeka No. 10',
          city: 'Bandung',
          postal_code: '40115',
        },
        items: [
          {
            product_name: 'Blueberry Splash Greek',
            variant: '250ml',
            quantity: 3,
            price: 25000,
          },
        ],
      });

      assert.ok(order.notifications);
      assert.equal(order.notifications.length, 1);
      const notif = order.notifications[0];
      assert.equal(notif.event, 'ORDER_CREATED');
      assert.equal(notif.recipient_phone, '6281987654321');
      assert.ok(notif.wa_link.startsWith('https://wa.me/6281987654321?text='));
      assert.ok(notif.message.includes('CMY-NOTIF-0001'));
    });

    it('generates notification for PAYMENT_CONFIRMED event', () => {
      adminOrderStore.setStock('Blueberry Splash Greek', '250ml', 10, 0);

      const order = adminOrderStore.addOrder({
        order_number: 'CMY-NOTIF-0002',
        order_status: 'WAITING_PAYMENT',
        customer: {
          name: 'Ahmad Faiz',
          whatsapp: '085712345678',
          address: 'Jl. Dago No. 12',
          city: 'Bandung',
          postal_code: '40135',
        },
        items: [
          {
            product_name: 'Blueberry Splash Greek',
            variant: '250ml',
            quantity: 2,
            price: 25000,
          },
        ],
      });

      // Update to PAYMENT_CONFIRMED
      const res = adminOrderStore.updateOrderStatus(order.id, 'PAYMENT_CONFIRMED', 'admin_staff');
      assert.equal(res.success, true);

      const notifs = res.order?.notifications || [];
      assert.equal(notifs.length, 2); // ORDER_CREATED + PAYMENT_CONFIRMED
      const confirmedNotif = notifs.find((n) => n.event === 'PAYMENT_CONFIRMED');
      assert.ok(confirmedNotif);
      assert.ok(confirmedNotif?.message.includes('PEMBAYARAN TERKONFIRMASI'));
      assert.ok(confirmedNotif?.message.includes('CMY-NOTIF-0002'));
      assert.ok(confirmedNotif?.wa_link.includes('6285712345678'));
    });

    it('generates notification for ORDER_PROCESSING and READY_TO_SHIP events', () => {
      adminOrderStore.setStock('Blueberry Splash Greek', '250ml', 10, 2);

      const order = adminOrderStore.addOrder({
        order_number: 'CMY-NOTIF-0003',
        order_status: 'PAYMENT_CONFIRMED',
        customer: {
          name: 'Siti Rahma',
          whatsapp: '082198765432',
          address: 'Jl. Riau No. 45',
          city: 'Bandung',
          postal_code: '40114',
        },
        items: [
          {
            product_name: 'Blueberry Splash Greek',
            variant: '250ml',
            quantity: 2,
            price: 25000,
          },
        ],
      });

      // Transition to PROCESSING
      const resProc = adminOrderStore.updateOrderStatus(order.id, 'PROCESSING', 'admin_pack');
      assert.equal(resProc.success, true);
      const procNotif = resProc.order?.notifications.find((n) => n.event === 'ORDER_PROCESSING');
      assert.ok(procNotif);
      assert.ok(procNotif?.message.includes('PESANAN SEDANG DIPROSES'));

      // Transition to READY_TO_SHIP
      const resShip = adminOrderStore.updateOrderStatus(order.id, 'READY_TO_SHIP', 'admin_pack');
      assert.equal(resShip.success, true);
      const shipNotif = resShip.order?.notifications.find((n) => n.event === 'ORDER_READY_TO_SHIP');
      assert.ok(shipNotif);
      assert.ok(shipNotif?.message.includes('PESANAN SIAP DIKIRIM'));
      assert.ok(shipNotif?.message.includes('Cold Chain') || shipNotif?.message.includes('Rantai Dingin'));

      // Transition to DELIVERED
      const resDeliv = adminOrderStore.updateOrderStatus(order.id, 'DELIVERED', 'admin_courier');
      assert.equal(resDeliv.success, true);
      const delivNotif = resDeliv.order?.notifications.find((n) => n.event === 'ORDER_DELIVERED');
      assert.ok(delivNotif);
      assert.ok(delivNotif?.message.includes('PESANAN TELAH TIBA'));
      assert.ok(delivNotif?.message.includes('kulkas'));
    });
  });

  describe('Task 8: Security & Zero-Trust Checks', () => {
    it('does not expose internal DB IDs or secrets in generated WhatsApp messages', () => {
      const order = adminOrderStore.addOrder({
        order_number: 'CMY-SEC-9999',
        order_status: 'WAITING_PAYMENT',
        customer: {
          name: 'Jane Doe',
          whatsapp: '081299998888',
          address: 'Jl. Asia Afrika No. 1',
          city: 'Bandung',
          postal_code: '40111',
        },
        items: [],
      });

      const notif = order.notifications[0];
      assert.ok(notif);
      // Ensure private internal UUIDs or secrets are not exposed in message
      assert.ok(!notif.message.includes(order.id));
      assert.ok(!notif.message.includes('SECRET'));
      assert.ok(!notif.message.includes('API_KEY'));
      assert.ok(!notif.wa_link.includes('SECRET'));
    });
  });
});
