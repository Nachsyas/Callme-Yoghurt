import { ManualQRISPaymentProvider } from './providers/manual-qris-provider.ts';
import { MidtransPaymentProvider } from './providers/midtrans-provider.ts';
import { XenditPaymentProvider } from './providers/xendit-provider.ts';
import type {
  PaymentCallbackPayload,
  PaymentCallbackResult,
  PaymentProvider,
  PaymentProviderType,
  PaymentRequestInput,
  PaymentTransactionResult,
  PaymentVerificationInput,
  PaymentVerificationResult,
} from './types.ts';

/**
 * Payment Service Layer (Phase 1.7C.14)
 *
 * Architecture:
 * Checkout -> Payment Service -> Payment Provider (Manual QRIS | Midtrans | Xendit)
 *
 * Responsibilities:
 * - Manages pluggable payment providers.
 * - Enforces payment lifecycle: PENDING_PAYMENT -> PAID | FAILED | EXPIRED.
 * - Selects active provider via PAYMENT_PROVIDER env (defaults to manual_qris).
 * - Zero secrets exposed to client.
 */
export class PaymentService {
  private readonly providers: Map<PaymentProviderType, PaymentProvider> = new Map();
  private activeProviderType: PaymentProviderType;

  constructor(defaultProviderType?: PaymentProviderType) {
    // Register available providers
    this.registerProvider(new ManualQRISPaymentProvider());
    this.registerProvider(new MidtransPaymentProvider());
    this.registerProvider(new XenditPaymentProvider());

    const envProvider =
      typeof process !== 'undefined' && process.env && process.env.PAYMENT_PROVIDER
        ? (process.env.PAYMENT_PROVIDER as PaymentProviderType)
        : undefined;

    this.activeProviderType = defaultProviderType || envProvider || 'manual_qris';
  }

  public registerProvider(provider: PaymentProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(type?: PaymentProviderType): PaymentProvider {
    const targetType = type || this.activeProviderType;
    const provider = this.providers.get(targetType);
    if (!provider) {
      throw new Error(`Payment provider '${targetType}' is not registered.`);
    }
    return provider;
  }

  public setActiveProvider(type: PaymentProviderType): void {
    if (!this.providers.has(type)) {
      throw new Error(`Cannot set active provider to unregistered type: '${type}'.`);
    }
    this.activeProviderType = type;
  }

  public getActiveProviderType(): PaymentProviderType {
    return this.activeProviderType;
  }

  /**
   * Initializes a payment transaction for a confirmed checkout order.
   * Produces a PENDING_PAYMENT state with payment instructions.
   */
  public async createPayment(
    input: PaymentRequestInput,
    providerType?: PaymentProviderType,
  ): Promise<PaymentTransactionResult> {
    const provider = this.getProvider(providerType);
    return provider.createPayment(input);
  }

  /**
   * Verifies the current status of an existing payment transaction.
   */
  public async verifyPayment(
    input: PaymentVerificationInput,
    providerType?: PaymentProviderType,
  ): Promise<PaymentVerificationResult> {
    const provider = this.getProvider(providerType);
    return provider.verifyPayment(input);
  }

  /**
   * Processes a webhook callback payload from a payment provider.
   */
  public async handleCallback(
    payload: PaymentCallbackPayload,
    providerType?: PaymentProviderType,
  ): Promise<PaymentCallbackResult> {
    const provider = this.getProvider(providerType);
    return provider.handleCallback(payload);
  }
}

// Global singleton instance for application use
export const defaultPaymentService = new PaymentService();
