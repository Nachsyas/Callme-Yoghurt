import {
  type ShippingProvider,
  type ShippingCalculationInput,
  type ShippingCalculationOutput,
} from './types.ts';
import { BiteshipShippingProvider } from './biteship-provider.ts';

/**
 * Phase 1.7C.19 Task 11:
 * Cold chain handling is operationally required, but whether it is separately charged
 * is a business decision. Per task specification, do not automatically charge Rp 5.000.
 * Default is set to 0.
 */
export const DEFAULT_COLD_CHAIN_FEE = 0;

/**
 * ManualShippingProvider
 * Built-in fallback / fixture shipping provider.
 */
export class ManualShippingProvider implements ShippingProvider {
  public readonly name = 'Manual';

  public calculateShipping(input: ShippingCalculationInput): ShippingCalculationOutput {
    const coldChainFee = DEFAULT_COLD_CHAIN_FEE;
    const billableWeightKg = Math.max(1, Math.ceil(input.weight || (input.weight_grams ? input.weight_grams / 1000 : 1)));

    switch (input.delivery_method) {
      case 'instant': {
        const baseRate = 20000;
        const extraWeightFee = (billableWeightKg - 1) * 5000;
        const shippingFee = baseRate + extraWeightFee;

        return {
          service: 'Instant Courier',
          shipping_fee: Math.max(0, shippingFee),
          estimated_delivery: '1-3 hours',
          cold_chain_fee: coldChainFee,
        };
      }

      case 'sameday': {
        const baseRate = 15000;
        const extraWeightFee = (billableWeightKg - 1) * 3000;
        const shippingFee = baseRate + extraWeightFee;

        return {
          service: 'Same Day Delivery',
          shipping_fee: Math.max(0, shippingFee),
          estimated_delivery: 'same day',
          cold_chain_fee: coldChainFee,
        };
      }

      case 'nextday': {
        const baseRate = 18000;
        const extraWeightFee = (billableWeightKg - 1) * 4000;
        const shippingFee = baseRate + extraWeightFee;

        return {
          service: 'Next Day Delivery (Overnight)',
          shipping_fee: Math.max(0, shippingFee),
          estimated_delivery: '1 day',
          cold_chain_fee: coldChainFee,
        };
      }

      case 'pickup': {
        return {
          service: 'Pickup Toko',
          shipping_fee: 0,
          estimated_delivery: 'same day (ready for pickup)',
          cold_chain_fee: coldChainFee,
        };
      }

      default:
        throw new Error(`Unsupported delivery method: ${input.delivery_method}`);
    }
  }
}

export { BiteshipShippingProvider };

/**
 * RajaOngkirShippingProvider
 * Abstraction stub for future RajaOngkir Pro/Starter API integration.
 */
export class RajaOngkirShippingProvider implements ShippingProvider {
  public readonly name = 'RajaOngkir';

  constructor(private readonly apiKey?: string) {}

  public async calculateShipping(
    input: ShippingCalculationInput
  ): Promise<ShippingCalculationOutput> {
    const fallback = new ManualShippingProvider();
    return fallback.calculateShipping(input);
  }
}
