/**
 * Callme Yoghurt — Payment Infrastructure Foundation Types (Phase 1.7C.14)
 *
 * Architecture Invariants:
 * - End-to-End Type Safety: Zero `any` types.
 * - Payment lifecycle: PENDING_PAYMENT -> PAID | FAILED | EXPIRED.
 * - Provider abstraction: Pluggable providers (Manual QRIS, Midtrans placeholder, Xendit placeholder).
 * - Zero Secret Leakage: Secret keys are private to server-side only, never client-exposed.
 */

export type PaymentStatus = 'PENDING_PAYMENT' | 'PAID' | 'FAILED' | 'EXPIRED';

export type PaymentProviderType = 'manual_qris' | 'midtrans' | 'xendit';

export interface PaymentCustomerInfo {
  name: string;
  whatsapp: string;
  address?: string;
}

export interface PaymentRequestInput {
  orderId: string;
  orderNumber: string;
  amount: number;
  customer: PaymentCustomerInfo;
  deliveryMethod?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PaymentTransactionResult {
  paymentId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  provider: PaymentProviderType;
  status: PaymentStatus;
  accountName?: string;
  qrCodeUrl?: string;
  qrString?: string;
  instructions: string[];
  expiresAt: string;
  paymentDeadlineMinutes: number;
  rawProviderData?: Record<string, string | number | boolean>;
}

export interface PaymentVerificationInput {
  paymentId: string;
  orderId?: string;
  orderNumber?: string;
}

export interface PaymentVerificationResult {
  paymentId: string;
  orderId?: string;
  status: PaymentStatus;
  amount: number;
  paidAt?: string;
  rawProviderData?: Record<string, string | number | boolean>;
}

export interface PaymentCallbackPayload {
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface PaymentCallbackResult {
  orderId: string;
  paymentId: string;
  status: PaymentStatus;
  acknowledged: boolean;
  message?: string;
}

/**
 * Standard contract for all payment providers.
 * Real payment gateways (Midtrans, Xendit) and manual methods (Manual QRIS) implement this interface.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderType;
  readonly name: string;
  createPayment(input: PaymentRequestInput): Promise<PaymentTransactionResult>;
  verifyPayment(input: PaymentVerificationInput): Promise<PaymentVerificationResult>;
  handleCallback(payload: PaymentCallbackPayload): Promise<PaymentCallbackResult>;
}
