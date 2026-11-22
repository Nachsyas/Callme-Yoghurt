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
 * Official Callme Yoghurt Manual QRIS merchant metadata.
 * Single source of truth used across payment service, checkout preview, and post-order payment instructions.
 */
export const OFFICIAL_MANUAL_QRIS_MERCHANT = {
  accountName: 'CALLME YOGHURT CIPAYUNG DRINK JP',
  nmid: 'ID1026505664866',
  terminalId: 'A01',
  qrCodeUrl: '/images/qris-callme.jpg',
  qrCodeWidth: 726,
  qrCodeHeight: 1024,
  deadlineMinutes: 30,
} as const;

/**
 * Zero-Trust QRIS asset resolver.
 * Never trusts arbitrary external or tampered storage URLs for Manual QRIS payment display;
 * always resolves to the official internal Callme Yoghurt QRIS asset.
 */
export function resolveSafeManualQrisImageUrl(candidateUrl?: string): string {
  if (candidateUrl === OFFICIAL_MANUAL_QRIS_MERCHANT.qrCodeUrl) {
    return candidateUrl;
  }
  return OFFICIAL_MANUAL_QRIS_MERCHANT.qrCodeUrl;
}

/**
 * Manual QRIS Payment Provider (Phase 1.7C.14)
 *
 * Designed for official Manual QRIS merchant operations (CALLME YOGHURT CIPAYUNG DRINK JP).
 * Produces a PENDING_PAYMENT transaction with customer instructions,
 * payment deadline, and structured confirmation metadata.
 */
export class ManualQRISPaymentProvider implements PaymentProvider {
  public readonly id: PaymentProviderType = 'manual_qris';
  public readonly name = 'QRIS (Manual Confirmation)';

  private readonly defaultAccountName = OFFICIAL_MANUAL_QRIS_MERCHANT.accountName;
  private readonly defaultNmid = OFFICIAL_MANUAL_QRIS_MERCHANT.nmid;
  private readonly defaultTerminalId = OFFICIAL_MANUAL_QRIS_MERCHANT.terminalId;
  private readonly defaultDeadlineMinutes = OFFICIAL_MANUAL_QRIS_MERCHANT.deadlineMinutes;

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
      'Pindai (scan) atau unduh kode QRIS resmi Callme Yoghurt di layar.',
      `Pastikan nama penerima tertera: ${this.defaultAccountName} (NMID: ${this.defaultNmid}).`,
      `Pastikan jumlah transfer tepat: Rp ${formattedAmount} (termasuk ongkir & biaya layanan).`,
      `Selesaikan pembayaran sebelum batas waktu berakhir (${this.defaultDeadlineMinutes} menit).`,
      'Klik tombol "Saya Sudah Membayar" dan kirimkan bukti transfer melalui WhatsApp resmi kami.',
    ];

    return {
      paymentId: `PAY-QRIS-${input.orderNumber}`,
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      amount: input.amount,
      provider: this.id,
      status: 'PENDING_PAYMENT',
      accountName: this.defaultAccountName,
      nmid: this.defaultNmid,
      terminalId: this.defaultTerminalId,
      qrCodeUrl: OFFICIAL_MANUAL_QRIS_MERCHANT.qrCodeUrl,
      instructions,
      expiresAt,
      paymentDeadlineMinutes: this.defaultDeadlineMinutes,
      rawProviderData: {
        method: 'manual_qris',
        account: this.defaultAccountName,
        nmid: this.defaultNmid,
        terminalId: this.defaultTerminalId,
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
