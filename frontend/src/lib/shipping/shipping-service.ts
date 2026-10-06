import {
  type ShippingCalculationInput,
  type ShippingCalculationOutput,
  type ShippingProvider,
  type ShippingQuote,
} from './types.ts';
import { ManualShippingProvider, BiteshipShippingProvider, DEFAULT_COLD_CHAIN_FEE } from './shipping-provider.ts';

/**
 * EXPLICIT TEST FIXTURE ONLY (Phase 1.7C.19 Task 4):
 * Used strictly for unit tests and integration tests where real measured package
 * weight has not yet been physically weighed by store owner.
 */
export const TEST_FIXTURE_WEIGHT_GRAMS = 1000;

/**
 * Resolves authoritative measured shipping weight in grams.
 *
 * CRITICAL BUSINESS RULE (Task 4):
 * Real package weight must include bottle, yoghurt product, ice gel packs, and thermal box.
 * Do NOT infer weight from volume (e.g. 250ml != 250g).
 * Returns undefined if any item lacks owner-configured measured weight.
 */
export function resolveAuthoritativePackageWeightGrams(
  items: Array<{ weight_grams?: number; quantity: number }>
): number | undefined {
  if (!items || items.length === 0) return undefined;

  let totalGrams = 0;
  for (const item of items) {
    if (typeof item.weight_grams !== 'number' || item.weight_grams <= 0) {
      return undefined; // Lacks authoritative measured weight
    }
    totalGrams += Math.round(item.weight_grams * (item.quantity || 1));
  }

  return totalGrams;
}

/**
 * LEGACY / AUDIT FINDING:
 * Fabricated approximation previously used in Phase 1.7C.13.
 * Kept strictly for backward-compatible display fallback where explicit weight is missing.
 * Must NOT be treated as production truth for actual courier rate commitment.
 */
export function calculateWeightFromItems(
  items: Array<{ volume_ml?: number; quantity: number }>
): number {
  if (!items || items.length === 0) return 0;

  const totalKg = items.reduce((acc, item) => {
    const ml = item.volume_ml || 250;
    const unitKg = ml === 1000 ? 1.1 : ml === 500 ? 0.6 : 0.3;
    return acc + unitKg * (item.quantity || 1);
  }, 0);

  return Math.round(totalKg * 100) / 100;
}

/**
 * ShippingCalculationService
 * Encapsulates shipping rates and cold chain fee logic cleanly outside the UI layer.
 */
export class ShippingCalculationService {
  private provider: ShippingProvider;

  constructor(provider: ShippingProvider = new BiteshipShippingProvider()) {
    this.provider = provider;
  }

  public setProvider(provider: ShippingProvider): void {
    this.provider = provider;
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  /**
   * Direct calculate using active provider.
   */
  public calculate(input: ShippingCalculationInput): ShippingCalculationOutput {
    const result = this.provider.calculateShipping(input);
    if (result instanceof Promise) {
      // Synchronous fallback fails safe if async cannot be resolved synchronously
      return {
        service: this.provider.name,
        shipping_fee: 0,
        estimated_delivery: '-',
        cold_chain_fee: 0,
        uncalculated: true,
        error: 'Ongkir belum dapat dihitung secara sinkron.',
      };
    }
    return result;
  }

  /**
   * Async calculate supporting external API providers (Biteship, RajaOngkir).
   */
  public async calculateAsync(input: ShippingCalculationInput): Promise<ShippingCalculationOutput> {
    return Promise.resolve(this.provider.calculateShipping(input));
  }

  /**
   * Retrieves all quotes conforming to ShippingProvider interface.
   */
  public async getQuotesAsync(input: ShippingCalculationInput): Promise<ShippingQuote[]> {
    if (typeof this.provider.getQuotes === 'function') {
      return this.provider.getQuotes(input);
    }
    const calc = await this.calculateAsync(input);
    return calc.available_quotes || [];
  }
}

// Global default singleton instance
export const defaultShippingService = new ShippingCalculationService();

export { DEFAULT_COLD_CHAIN_FEE };
