import type {
  PaymentCallbackPayload,
  PaymentCallbackResult,
  PaymentProvider,
  PaymentProviderType,
  PaymentRequestInput,
  PaymentTransactionResult,
  PaymentVerificationInput,
  PaymentVerificationResult,
} from '../types.ts';

/**
 * Xendit Payment Provider (Phase 1.7C.14 Placeholder)
 *
 * Prepared for future Xendit Invoice / QR Code API integration.
 * Invariants:
 * - Does NOT invoke external Xendit APIs during foundation phase.
 * - Secret keys (XENDIT_SECRET_KEY) are accessed solely on the server environment.
 * - Type-safe signatures for createPayment, verifyPayment, and handleCallback.
 */
export class XenditPaymentProvider implements PaymentProvider {
  public readonly id: PaymentProviderType = 'xendit';
  public readonly name = 'Xendit Payment Gateway (Invoice / QR API)';

  private getSecretKey(): string | null {
    // SECURITY INVARIANT: Secret keys are strictly accessible in server/Node environment
    if (typeof window !== 'undefined') {
      return null;
    }
    return process.env.XENDIT_SECRET_KEY || null;
  }

  public async createPayment(input: PaymentRequestInput): Promise<PaymentTransactionResult> {
    if (input.amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const secretKey = this.getSecretKey();
    const hasConfig = Boolean(secretKey);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

    // Placeholder transaction response without external API call
    return {
      paymentId: `XEN-INV-${input.orderNumber}`,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      amount: input.amount,
      provider: this.id,
      status: 'PENDING_PAYMENT',
      paymentDeadlineMinutes: 60,
      expiresAt,
      instructions: [
        'Buka tautan invoice Xendit yang disediakan.',
        'Pilih opsi pembayaran QRIS, Virtual Account, atau Retail Outlet (Alfamart/Indomaret).',
        'Lakukan transfer sebelum masa berlaku invoice habis.',
      ],
      rawProviderData: {
        placeholder: true,
        configured: hasConfig,
        merchantId: 'CALLME_XENDIT_STAGING',
      },
    };
  }

  public async verifyPayment(input: PaymentVerificationInput): Promise<PaymentVerificationResult> {
    // Placeholder verification query: returns PENDING_PAYMENT
    return {
      paymentId: input.paymentId,
      orderId: input.orderId,
      status: 'PENDING_PAYMENT',
      amount: 0,
      rawProviderData: {
        placeholder: true,
        channel: 'xendit_invoice_api',
      },
    };
  }

  public async handleCallback(payload: PaymentCallbackPayload): Promise<PaymentCallbackResult> {
    const body = payload.body;
    const orderId = String(body.external_id || '');
    const invoiceStatus = String(body.status || '');

    let status: PaymentTransactionResult['status'] = 'PENDING_PAYMENT';
    if (invoiceStatus === 'PAID' || invoiceStatus === 'SETTLED') {
      status = 'PAID';
    } else if (invoiceStatus === 'EXPIRED') {
      status = 'EXPIRED';
    }

    return {
      orderId,
      paymentId: String(body.id || `XEN-${orderId}`),
      status,
      acknowledged: true,
      message: `Xendit webhook processed with status: ${status}`,
    };
  }
}
