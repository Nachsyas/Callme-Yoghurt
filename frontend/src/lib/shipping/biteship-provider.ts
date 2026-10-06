/**
 * Biteship Shipping Provider (Phase 1.7C.19)
 *
 * Implements ShippingProvider abstraction with server-side Biteship Rates integration,
 * Cold-Chain business filter, and safe fallback handling.
 */

import { getBiteshipConfig, validateBiteshipOriginConfig } from './biteship-config.ts';
import { BiteshipClient, biteshipClient } from './biteship-client.ts';
import { filterColdChainQuotes, isJakartaLocation } from './cold-chain-filter.ts';
import type {
  BiteshipOriginConfig,
  BiteshipRateItemPayload,
  ShippingCalculationInput,
  ShippingCalculationOutput,
  ShippingProvider,
  ShippingQuote,
} from './types.ts';

export class BiteshipShippingProvider implements ShippingProvider {
  public readonly name = 'Biteship';
  private readonly customApiKey?: string;
  private readonly customOrigin?: BiteshipOriginConfig;
  private readonly client: BiteshipClient;

  constructor(
    customApiKey?: string,
    customOrigin?: BiteshipOriginConfig,
    customClient?: BiteshipClient
  ) {
    this.customApiKey = customApiKey;
    this.customOrigin = customOrigin;
    this.client = customClient || biteshipClient;
  }

  /**
   * Fetches all cold-chain compliant shipping quotes from Biteship.
   */
  public async fetchQuotes(
    input: ShippingCalculationInput
  ): Promise<{ success: boolean; quotes: ShippingQuote[]; error?: string }> {
    const config = getBiteshipConfig();
    const apiKey = this.customApiKey || config.apiKey;
    const origin = this.customOrigin || config.origin;

    if (!apiKey) {
      return {
        success: false,
        quotes: [],
        error: 'Ongkir belum dapat dihitung: BITESHIP_API_KEY belum dikonfigurasi.',
      };
    }

    const originValidation = validateBiteshipOriginConfig(origin);
    if (!originValidation.valid) {
      return {
        success: false,
        quotes: [],
        error: `Ongkir belum dapat dihitung: Konfigurasi asal toko belum lengkap (${originValidation.missingFields.join(', ')}).`,
      };
    }

    // Determine package weight in grams
    let totalWeightGrams = 0;
    if (input.weight_grams && input.weight_grams > 0) {
      totalWeightGrams = Math.round(input.weight_grams);
    } else if (input.items && input.items.length > 0) {
      for (const item of input.items) {
        if (item.weight_grams && item.weight_grams > 0) {
          totalWeightGrams += item.weight_grams * (item.quantity || 1);
        }
      }
    }

    // If total weight is still 0, check legacy input.weight (kg)
    if (totalWeightGrams === 0 && input.weight && input.weight > 0) {
      totalWeightGrams = Math.round(input.weight * 1000);
    }

    // If still zero, we must require authoritative weight rather than guessing
    if (totalWeightGrams <= 0) {
      return {
        success: false,
        quotes: [],
        error: 'Ongkir belum dapat dihitung: Berat pengiriman definitif belum ditentukan untuk produk.',
      };
    }

    // Prepare items payload for Biteship
    const rateItems: BiteshipRateItemPayload[] =
      input.items && input.items.length > 0
        ? input.items.map((i) => ({
            name: i.name,
            description: i.description || 'Callme Yoghurt',
            value: i.value || 35000,
            quantity: i.quantity || 1,
            weight: i.weight_grams || Math.round(totalWeightGrams / (input.items?.length || 1)),
          }))
        : [
            {
              name: 'Paket Callme Yoghurt (Cold Chain)',
              value: 50000,
              quantity: 1,
              weight: totalWeightGrams,
            },
          ];

    // Determine target couriers to query
    // Instant/Same Day: grab, gojek, anteraja, paxel
    // Next Day: jne, tiki, paxel, sicepat
    const couriers = 'grab,gojek,paxel,jne,tiki,anteraja,sicepat';

    const ratesResult = await this.client.getRates(
      {
        origin_latitude: origin.latitude,
        origin_longitude: origin.longitude,
        origin_postal_code: origin.postal_code,
        origin_area_id: origin.area_id,
        destination_latitude: input.destination_latitude,
        destination_longitude: input.destination_longitude,
        destination_postal_code: input.destination_postal_code || input.postal_code,
        destination_area_id: input.destination_area_id,
        couriers,
        items: rateItems,
      },
      { apiKey }
    );

    if (!ratesResult.success) {
      return {
        success: false,
        quotes: [],
        error: ratesResult.error ? `Ongkir belum dapat dihitung: ${ratesResult.error}` : 'Ongkir belum dapat dihitung.',
      };
    }

    // Filter via Cold-Chain Business Filter (SOP 01)
    const quotes = filterColdChainQuotes(ratesResult.rates, {
      province: input.province,
      city: input.city,
      isJakarta: isJakartaLocation({ province: input.province, city: input.city }),
    });

    if (quotes.length === 0) {
      return {
        success: false,
        quotes: [],
        error: 'Ongkir belum dapat dihitung: Tidak ada opsi kurir rantai dingin yang memenuhi syarat ke tujuan ini.',
      };
    }

    return {
      success: true,
      quotes,
    };
  }

  /**
   * Retrieves all quotes conforming to ShippingProvider interface.
   */
  public async getQuotes(input: ShippingCalculationInput): Promise<ShippingQuote[]> {
    const result = await this.fetchQuotes(input);
    return result.quotes;
  }

  /**
   * Calculates shipping fee for requested delivery method.
   * If specific method requested (e.g., 'instant'), picks the best matching quote.
   */
  public async calculateShipping(
    input: ShippingCalculationInput
  ): Promise<ShippingCalculationOutput> {
    const quotesResult = await this.fetchQuotes(input);

    if (!quotesResult.success || quotesResult.quotes.length === 0) {
      // Per Task 10: DO NOT silently fall back to fake prices. Fail closed with clear error.
      return {
        service: 'Biteship',
        shipping_fee: 0,
        estimated_delivery: '-',
        cold_chain_fee: 0,
        uncalculated: true,
        error: quotesResult.error || 'Ongkir belum dapat dihitung',
      };
    }

    const availableQuotes = quotesResult.quotes;

    // Match requested delivery method
    let matchedQuote: ShippingQuote | undefined;
    if (input.delivery_method === 'instant') {
      matchedQuote = availableQuotes.find((q) => q.service_type === 'instant');
    } else if (input.delivery_method === 'sameday') {
      matchedQuote = availableQuotes.find((q) => q.service_type === 'sameday');
    } else if (input.delivery_method === 'nextday') {
      matchedQuote = availableQuotes.find((q) => q.service_type === 'nextday');
    }

    // If specific requested method has no quote, return uncalculated for that method
    if (!matchedQuote) {
      return {
        service: `Biteship (${input.delivery_method})`,
        shipping_fee: 0,
        estimated_delivery: '-',
        cold_chain_fee: 0,
        available_quotes: availableQuotes,
        uncalculated: true,
        error: `Layanan pengiriman ${input.delivery_method} tidak tersedia ke alamat tujuan.`,
      };
    }

    return {
      service: `${matchedQuote.courier_name} ${matchedQuote.service_name}`,
      shipping_fee: matchedQuote.price,
      estimated_delivery: matchedQuote.duration,
      cold_chain_fee: 0, // Task 11: Do not charge unapproved Rp 5.000 fee
      quote_id: matchedQuote.quote_id,
      courier_name: matchedQuote.courier_name,
      courier_code: matchedQuote.courier_code,
      available_quotes: availableQuotes,
    };
  }
}
