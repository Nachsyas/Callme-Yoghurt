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
 * Midtrans Payment Provider (Phase 1.7C.14 Placeholder)
 *
 * Prepared for future Midtrans Snap / Core API integration.
 * Invariants:
 * - Does NOT invoke external Midtrans APIs during foundation phase.
 * - Secret keys (MIDTRANS_SERVER_KEY) are accessed solely on the server environment.
 * - Type-safe signatures for createPayment, verifyPayment, and handleCallback.
 */
export class MidtransPaymentProvider implements PaymentProvider {
  public readonly id: PaymentProviderType = 'midtrans';
  public readonly name = 'Midtrans Payment Gateway (Snap / Core API)';

  private getServerKey(): string | null {
    // SECURITY INVARIANT: Server keys are strictly accessible in server/Node environment
    if (typeof window !== 'undefined') {
      return null;
    }
    return process.env.MIDTRANS_SERVER_KEY || null;
  }

  private getClientKey(): string | null {
    if (typeof window !== 'undefined') {
      return null;
    }
    return process.env.MIDTRANS_CLIENT_KEY || null;
  }

  public async createPayment(input: PaymentRequestInput): Promise<PaymentTransactionResult> {
    if (input.amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const serverKey = this.getServerKey();
    const hasConfig = Boolean(serverKey);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

    // Placeholder transaction response without external API call
    return {
      paymentId: `MIDTRANS-${input.orderNumber}`,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      amount: input.amount,
      provider: this.id,
      status: 'PENDING_PAYMENT',
      paymentDeadlineMinutes: 60,
      expiresAt,
      instructions: [
        'Klik tautan pembayaran Midtrans Snap yang tersedia.',
        'Pilih metode pembayaran (GoPay, QRIS, Virtual Account BCA/Mandiri/BRI, Kartu Kredit).',
        'Selesaikan pembayaran sebelum batas waktu berakhir.',
      ],
      rawProviderData: {
        placeholder: true,
        configured: hasConfig,
        merchantId: 'CALLME_MIDTRANS_STAGING',
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
        channel: 'midtrans_status_api',
      },
    };
  }

  public async handleCallback(payload: PaymentCallbackPayload): Promise<PaymentCallbackResult> {
    const body = payload.body;
    const orderId = String(body.order_id || '');
    const transactionStatus = String(body.transaction_status || '');

    let status: PaymentTransactionResult['status'] = 'PENDING_PAYMENT';
    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      status = 'PAID';
    } else if (transactionStatus === 'deny' || transactionStatus === 'cancel') {
      status = 'FAILED';
    } else if (transactionStatus === 'expire') {
      status = 'EXPIRED';
    }

    return {
      orderId,
      paymentId: String(body.transaction_id || `MIDTRANS-${orderId}`),
      status,
      acknowledged: true,
      message: `Midtrans webhook processed with status: ${status}`,
    };
  }
}
