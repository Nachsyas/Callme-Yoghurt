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
 * Manual QRIS Payment Provider (Phase 1.7C.14)
 *
 * Designed for manual/personal QRIS operations (e.g. Callme Yoghurt BCA/GoPay QRIS).
 * Produces a PENDING_PAYMENT transaction with customer instructions,
 * payment deadline, and structured confirmation metadata.
 */
export class ManualQRISPaymentProvider implements PaymentProvider {
  public readonly id: PaymentProviderType = 'manual_qris';
  public readonly name = 'QRIS (Manual Confirmation)';

  private readonly defaultAccountName = 'CALLME YOGHURT INDONESIA';
  private readonly defaultDeadlineMinutes = 30;

  // Standard static QRIS payload representation for Callme Yoghurt
  private readonly mockQrString =
    '00020101021226670016ID.CO.QRIS.WWW01189360091800000000000215000000000000000303UME51440014ID.LINKAJA.WWW02150000000000000005204581253033605802ID5923CALLME YOGHURT JAKARTA6007JAKARTA61051389062070703A016304';

  public async createPayment(input: PaymentRequestInput): Promise<PaymentTransactionResult> {
    if (input.amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    if (!input.orderId || !input.orderNumber) {
      throw new Error('Missing required order identification for payment.');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.defaultDeadlineMinutes * 60 * 1000).toISOString();
    const formattedAmount = input.amount.toLocaleString('id-ID');

    const instructions: string[] = [
      'Buka aplikasi BCA Mobile, GoPay, OVO, ShopeePay, Dana, atau mobile banking Anda.',
      'Pindai (scan) kode QRIS Callme Yoghurt di layar.',
      `Pastikan nama penerima tertera: ${this.defaultAccountName}.`,
      `Pastikan jumlah transfer tepat: Rp ${formattedAmount} (termasuk kurir & handling cold chain).`,
      `Selesaikan pembayaran sebelum batas waktu berakhir (${this.defaultDeadlineMinutes} menit).`,
      'Klik tombol "Konfirmasi Pembayaran" dan kirimkan bukti transfer melalui WhatsApp resmi kami.',
    ];

    return {
      paymentId: `PAY-QRIS-${input.orderNumber}`,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      amount: input.amount,
      provider: this.id,
      status: 'PENDING_PAYMENT',
      accountName: this.defaultAccountName,
      qrString: this.mockQrString,
      qrCodeUrl: '/images/qris-callme.png',
      instructions,
      expiresAt,
      paymentDeadlineMinutes: this.defaultDeadlineMinutes,
      rawProviderData: {
        method: 'manual_qris',
        account: this.defaultAccountName,
        customerWhatsapp: input.customer.whatsapp,
      },
    };
  }

  public async verifyPayment(input: PaymentVerificationInput): Promise<PaymentVerificationResult> {
    // In manual QRIS mode, verification remains PENDING_PAYMENT until confirmed via admin or customer proof
    return {
      paymentId: input.paymentId,
      orderId: input.orderId,
      status: 'PENDING_PAYMENT',
      amount: 0,
      rawProviderData: {
        verificationMode: 'manual',
        requiresAdminProofCheck: true,
      },
    };
  }

  public async handleCallback(payload: PaymentCallbackPayload): Promise<PaymentCallbackResult> {
    const orderId = String(payload.body.order_id || '');
    const paymentId = String(payload.body.payment_id || '');

    return {
      orderId,
      paymentId,
      status: 'PENDING_PAYMENT',
      acknowledged: true,
      message: 'Manual confirmation logged. Awaiting admin settlement.',
    };
  }
}
