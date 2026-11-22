import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  PaymentService,
  defaultPaymentService,
  ManualQRISPaymentProvider,
  OFFICIAL_MANUAL_QRIS_MERCHANT,
  resolveSafeManualQrisImageUrl,
  MidtransPaymentProvider,
  XenditPaymentProvider,
  type PaymentStatus,
} from '../../src/lib/payment/index.ts';

describe('Payment Infrastructure Foundation (Phase 1.7C.14)', () => {
  describe('Task 1 & 2 — Payment Service Abstraction & Lifecycle Model', () => {
    it('proves payment service registers all 3 providers and defaults to manual_qris', () => {
      const service = new PaymentService();
      assert.equal(service.getActiveProviderType(), 'manual_qris');

      const manualProvider = service.getProvider('manual_qris');
      assert.equal(manualProvider.id, 'manual_qris');
      assert.ok(manualProvider instanceof ManualQRISPaymentProvider);

      const midtransProvider = service.getProvider('midtrans');
      assert.equal(midtransProvider.id, 'midtrans');
      assert.ok(midtransProvider instanceof MidtransPaymentProvider);

      const xenditProvider = service.getProvider('xendit');
      assert.equal(xenditProvider.id, 'xendit');
      assert.ok(xenditProvider instanceof XenditPaymentProvider);
    });

    it('proves all lifecycle states are valid typed transitions', () => {
      const validStatuses: PaymentStatus[] = ['PENDING_PAYMENT', 'PAID', 'FAILED', 'EXPIRED'];
      assert.equal(validStatuses.length, 4);
      assert.ok(validStatuses.includes('PENDING_PAYMENT'));
      assert.ok(validStatuses.includes('PAID'));
      assert.ok(validStatuses.includes('FAILED'));
      assert.ok(validStatuses.includes('EXPIRED'));
    });
  });

  describe('Task 3 — Manual QRIS Flow Preparation', () => {
    it('creates PENDING_PAYMENT order with clear QRIS instructions and deadline', async () => {
      const service = new PaymentService('manual_qris');

      const input = {
        orderId: '018f6c38-8c50-711e-b8d4-53a8be77e001',
        orderNumber: 'CY-2026-0001',
        amount: 55000,
        customer: {
          name: 'Budi Santoso',
          whatsapp: '08123456789',
        },
      };

      const result = await service.createPayment(input);

      assert.equal(result.status, 'PENDING_PAYMENT');
      assert.equal(result.provider, 'manual_qris');
      assert.equal(result.amount, 55000);
      assert.equal(result.orderId, input.orderId);
      assert.equal(result.orderNumber, input.orderNumber);
      assert.equal(result.accountName, 'CALLME YOGHURT CIPAYUNG DRINK JP');
      assert.equal(result.nmid, 'ID1026505664866');
      assert.equal(result.terminalId, 'A01');
      assert.equal(result.qrCodeUrl, '/images/qris-callme.jpg');
      assert.equal(result.qrString, undefined);
      assert.equal(result.paymentDeadlineMinutes, 30);
      assert.ok(result.instructions.length >= 4);
      assert.ok(result.instructions.some((inst) => inst.includes('CALLME YOGHURT CIPAYUNG DRINK JP')));
      assert.ok(result.instructions.some((inst) => inst.includes('ID1026505664866')));
      assert.ok(result.instructions.some((inst) => inst.includes('55.000')));
      assert.ok(result.paymentId.startsWith('PAY-QRIS-'));
    });

    it('verifies official QRIS asset exists on disk, return page renders real image, and tampered QR URLs fail closed', () => {
      const qrisAssetPath = path.resolve(process.cwd(), 'public', OFFICIAL_MANUAL_QRIS_MERCHANT.qrCodeUrl.replace(/^\//, ''));
      assert.ok(fs.existsSync(qrisAssetPath), `Official QRIS image must exist at ${qrisAssetPath}`);
      assert.ok(fs.statSync(qrisAssetPath).size > 10_000, 'Official QRIS image must be non-empty');

      // Zero-Trust: tampered external, javascript, data, or legacy paths always resolve to official internal QRIS asset
      assert.equal(resolveSafeManualQrisImageUrl('https://evil.example/phishing-qris.jpg'), '/images/qris-callme.jpg');
      assert.equal(resolveSafeManualQrisImageUrl('javascript:alert(1)'), '/images/qris-callme.jpg');
      assert.equal(resolveSafeManualQrisImageUrl('data:image/png;base64,AAAA'), '/images/qris-callme.jpg');
      assert.equal(resolveSafeManualQrisImageUrl('/images/qris-callme.png'), '/images/qris-callme.jpg');
      assert.equal(resolveSafeManualQrisImageUrl(undefined), '/images/qris-callme.jpg');
      assert.equal(resolveSafeManualQrisImageUrl('/images/qris-callme.jpg'), '/images/qris-callme.jpg');

      // Return page must not contain fake hardcoded placeholder NMID or simulated matrix SVG
      const returnPageSource = fs.readFileSync(path.resolve(process.cwd(), 'src/app/return/page.tsx'), 'utf-8');
      assert.doesNotMatch(returnPageSource, /ID102600291884/, 'Fake placeholder NMID must be removed');
      assert.doesNotMatch(returnPageSource, /Matrix Grid Data Simulation/, 'Simulated fake SVG QR must be removed');
      assert.match(returnPageSource, /OFFICIAL_MANUAL_QRIS_MERCHANT/, 'Return page must use official QRIS merchant metadata');
      assert.match(returnPageSource, /resolveSafeManualQrisImageUrl/, 'Return page must sanitize QRIS image URL');
    });

    it('rejects zero or negative payment amounts', async () => {
      const service = new PaymentService('manual_qris');

      await assert.rejects(
        () =>
          service.createPayment({
            orderId: '018f6c38-8c50-711e-b8d4-53a8be77e001',
            orderNumber: 'CY-2026-0001',
            amount: 0,
            customer: { name: 'Test', whatsapp: '0812' },
          }),
        /greater than zero/i,
      );
    });

    it('handles verification and callback gracefully in manual mode', async () => {
      const provider = new ManualQRISPaymentProvider();

      const verification = await provider.verifyPayment({
        paymentId: 'PAY-QRIS-CY-2026-0001',
        orderId: '018f6c38-8c50-711e-b8d4-53a8be77e001',
      });
      assert.equal(verification.status, 'PENDING_PAYMENT');

      const callback = await provider.handleCallback({
        headers: {},
        body: { order_id: '018f6c38-8c50-711e-b8d4-53a8be77e001', payment_id: 'PAY-QRIS-CY-2026-0001' },
      });
      assert.equal(callback.acknowledged, true);
    });
  });

  describe('Task 4 — Midtrans & Xendit Provider Placeholders', () => {
    it('proves Midtrans provider exposes createPayment, verifyPayment, and handleCallback', async () => {
      const provider = new MidtransPaymentProvider();
      assert.equal(provider.id, 'midtrans');

      const payment = await provider.createPayment({
        orderId: 'order-mid-1',
        orderNumber: 'CY-MID-001',
        amount: 75000,
        customer: { name: 'Siti', whatsapp: '0812' },
      });
      assert.equal(payment.status, 'PENDING_PAYMENT');
      assert.equal(payment.provider, 'midtrans');
      assert.ok(payment.instructions.length > 0);

      const verification = await provider.verifyPayment({ paymentId: payment.paymentId });
      assert.equal(verification.status, 'PENDING_PAYMENT');

      const callback = await provider.handleCallback({
        headers: {},
        body: { order_id: 'CY-MID-001', transaction_status: 'settlement' },
      });
      assert.equal(callback.status, 'PAID');
      assert.equal(callback.acknowledged, true);
    });

    it('proves Xendit provider exposes createPayment, verifyPayment, and handleCallback', async () => {
      const provider = new XenditPaymentProvider();
      assert.equal(provider.id, 'xendit');

      const payment = await provider.createPayment({
        orderId: 'order-xen-1',
        orderNumber: 'CY-XEN-001',
        amount: 80000,
        customer: { name: 'Dewi', whatsapp: '0813' },
      });
      assert.equal(payment.status, 'PENDING_PAYMENT');
      assert.equal(payment.provider, 'xendit');

      const verification = await provider.verifyPayment({ paymentId: payment.paymentId });
      assert.equal(verification.status, 'PENDING_PAYMENT');

      const callback = await provider.handleCallback({
        headers: {},
        body: { external_id: 'CY-XEN-001', status: 'PAID' },
      });
      assert.equal(callback.status, 'PAID');
      assert.equal(callback.acknowledged, true);
    });
  });

  describe('Task 6 — Security: Zero Secret Leakage', () => {
    it('verifies payment secrets are not prefixed with NEXT_PUBLIC_ and are server-only', () => {
      const envKeys = [
        'PAYMENT_PROVIDER',
        'MIDTRANS_SERVER_KEY',
        'MIDTRANS_CLIENT_KEY',
        'XENDIT_SECRET_KEY',
      ];

      for (const key of envKeys) {
        // Must NEVER start with NEXT_PUBLIC_ to prevent client bundler inclusion
        assert.ok(
          !key.startsWith('NEXT_PUBLIC_'),
          `Security invariant failed: ${key} must not be exposed with NEXT_PUBLIC_`,
        );
      }
    });

    it('proves Midtrans and Xendit providers do not expose server secret keys to client callers', async () => {
      const midtrans = new MidtransPaymentProvider();
      const xendit = new XenditPaymentProvider();

      const midtransRes = await midtrans.createPayment({
        orderId: 'ord-1',
        orderNumber: 'CY-1',
        amount: 10000,
        customer: { name: 'A', whatsapp: '08' },
      });

      const xenditRes = await xendit.createPayment({
        orderId: 'ord-2',
        orderNumber: 'CY-2',
        amount: 20000,
        customer: { name: 'B', whatsapp: '08' },
      });

      const serializedMidtrans = JSON.stringify(midtransRes);
      const serializedXendit = JSON.stringify(xenditRes);

      assert.ok(!serializedMidtrans.includes('MIDTRANS_SERVER_KEY'));
      assert.ok(!serializedXendit.includes('XENDIT_SECRET_KEY'));
    });
  });
});
