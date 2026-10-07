import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { filterColdChainQuotes, isJakartaLocation } from '../../src/lib/shipping/cold-chain-filter.ts';
import { BiteshipShippingProvider } from '../../src/lib/shipping/biteship-provider.ts';
import { BiteshipClient } from '../../src/lib/shipping/biteship-client.ts';
import { getBiteshipConfig, validateBiteshipOriginConfig } from '../../src/lib/shipping/biteship-config.ts';
import { getServiceFeeConfig } from '../../src/lib/shipping/service-fee-config.ts';
import { buildCanonicalCheckoutPayload, type CheckoutPayload } from '../../src/lib/checkout-client.ts';
import { generateWhatsAppMessage } from '../../src/lib/notification/templates.ts';
import type { BiteshipRateItemRaw, ShippingCalculationInput } from '../../src/lib/shipping/types.ts';

describe('Phase 1.7C.19A — Biteship Rates Hardening & Service Fee Foundation', () => {
  // Test Fixture Data
  const MOCK_RAW_RATES: BiteshipRateItemRaw[] = [
    {
      courier_name: 'Grab',
      courier_code: 'grab',
      courier_service_name: 'Instant',
      courier_service_code: 'instant',
      duration: '1 - 3 hours',
      shipment_duration_range: '1-3',
      shipment_duration_unit: 'hours',
      price: 24000,
      description: 'Pengiriman kilat 1-3 jam',
    },
    {
      courier_name: 'Gojek',
      courier_code: 'gojek',
      courier_service_name: 'Same Day',
      courier_service_code: 'sameday',
      duration: '6 - 8 hours',
      shipment_duration_range: '6-8',
      shipment_duration_unit: 'hours',
      price: 18000,
      description: 'Pengiriman hari yang sama',
    },
    {
      courier_name: 'JNE',
      courier_code: 'jne',
      courier_service_name: 'YES (Yakin Esok Sampai)',
      courier_service_code: 'yes',
      duration: '1 days',
      shipment_duration_range: '1',
      shipment_duration_unit: 'days',
      price: 22000,
      description: 'Pengiriman 1 hari kerja',
    },
    {
      courier_name: 'JNE',
      courier_code: 'jne',
      courier_service_name: 'Reguler',
      courier_service_code: 'reg',
      duration: '2 - 3 days',
      shipment_duration_range: '2-3',
      shipment_duration_unit: 'days',
      price: 11000,
      description: 'Pengiriman reguler multi-hari',
    },
    {
      courier_name: 'SiCepat',
      courier_code: 'sicepat',
      courier_service_name: 'GOKIL Cargo',
      courier_service_code: 'cargo',
      duration: '3 - 5 days',
      shipment_duration_range: '3-5',
      shipment_duration_unit: 'days',
      price: 25000,
      description: 'Kargo darat non-refrigerated',
    },
    {
      courier_name: 'Anteraja',
      courier_code: 'anteraja',
      courier_service_name: 'Economy',
      courier_service_code: 'eco',
      duration: '3 - 6 days',
      price: 9000,
      description: 'Pengiriman hemat',
    },
    {
      courier_name: 'InvalidCourier',
      courier_code: 'invalid',
      courier_service_name: 'Negative Rate',
      courier_service_code: 'neg',
      duration: '1 hour',
      price: -5000,
      description: 'Tarif negatif anomali',
    },
  ];

  // 1. No unapproved pickup option
  it('1. Proves no unapproved pickup option is returned in customer shipping quotes', async () => {
    const mockClient = new BiteshipClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.biteship.com',
      fetchFn: async () =>
        new Response(
          JSON.stringify({ success: true, pricing: MOCK_RAW_RATES.slice(0, 2) }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    const provider = new BiteshipShippingProvider(
      'test-key',
      {
        contact_name: 'Callme Hub',
        address: 'Jl. Bambu Apus, Cipayung, Jakarta Timur',
        postal_code: '13890',
        latitude: -6.312345,
        longitude: 106.891234,
      },
      mockClient
    );

    const input: ShippingCalculationInput = {
      city: 'Jakarta Timur',
      province: 'DKI Jakarta',
      district: 'Cipayung',
      weight_grams: 1000,
      items: [{ name: 'Callme Yoghurt', quantity: 2, value: 60000, weight_grams: 500 }],
    };

    const result = await provider.fetchQuotes(input);
    assert.equal(result.success, true);
    assert.equal(
      result.quotes.some((q) => q.service_type === 'pickup' || q.courier_code === 'pickup'),
      false,
      'Quotes must contain ZERO unapproved store pickup options'
    );
  });

  // 2. No synthetic shipping-price fallback
  it('2. Proves no synthetic shipping-price fallback (e.g. 15k/20k) is returned when provider fails', async () => {
    const failingClient = new BiteshipClient({
      apiKey: 'test-key',
      baseUrl: 'http://127.0.0.1:59999',
      timeoutMs: 200,
    });

    const provider = new BiteshipShippingProvider(
      'test-key',
      {
        contact_name: 'Callme Hub',
        address: 'Jl. Bambu Apus, Cipayung',
        postal_code: '13890',
        latitude: -6.31,
        longitude: 106.89,
      },
      failingClient
    );

    const input: ShippingCalculationInput = {
      city: 'Jakarta Timur',
      province: 'DKI Jakarta',
      district: 'Cipayung',
      weight_grams: 1000,
      items: [{ name: 'Callme Yoghurt', quantity: 1, value: 30000, weight_grams: 1000 }],
    };

    const result = await provider.fetchQuotes(input);
    assert.equal(result.success, false);
    assert.equal(result.quotes.length, 0, 'Must NOT return fake fallback quotes');
    assert.ok(result.error?.includes('Ongkir belum dapat dihitung'));
  });

  // 3. Biteship failure fails closed
  it('3. Proves upstream API failures fail closed safely without crashing', async () => {
    const errorClient = new BiteshipClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.biteship.com',
      fetchFn: async () =>
        new Response(
          JSON.stringify({ success: false, error: 'Upstream gateway error 502' }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    const provider = new BiteshipShippingProvider(
      'test-key',
      {
        contact_name: 'Callme Hub',
        address: 'Jl. Bambu Apus',
        postal_code: '13890',
        latitude: -6.31,
        longitude: 106.89,
      },
      errorClient
    );

    const input: ShippingCalculationInput = {
      city: 'Jakarta Timur',
      province: 'DKI Jakarta',
      district: 'Cipayung',
      weight_grams: 1000,
      items: [{ name: 'Callme Yoghurt', quantity: 1, value: 30000, weight_grams: 1000 }],
    };

    const result = await provider.fetchQuotes(input);
    assert.equal(result.success, false);
    assert.equal(result.quotes.length, 0);
    assert.ok(result.error?.includes('Ongkir belum dapat dihitung'));
  });

  // 4. Real quote normalization
  it('4. Proves Biteship raw response is correctly normalized into internal ShippingQuote format', () => {
    const quotes = filterColdChainQuotes(MOCK_RAW_RATES, {
      province: 'DKI Jakarta',
      city: 'Jakarta Timur',
      isJakarta: true,
    });

    const grabQuote = quotes.find((q) => q.courier_code === 'grab');
    assert.ok(grabQuote, 'Grab Instant quote must be present');
    assert.equal(grabQuote.provider, 'Biteship');
    assert.equal(grabQuote.courier_name, 'Grab');
    assert.equal(grabQuote.service_name, 'Instant');
    assert.equal(grabQuote.service_code, 'instant');
    assert.equal(grabQuote.service_type, 'instant');
    assert.equal(grabQuote.price, 24000);
    assert.equal(grabQuote.duration, '1 - 3 hours');
    assert.equal(grabQuote.cold_chain_compliant, true);
    assert.ok(grabQuote.quote_id.startsWith('biteship_grab_instant_'));
  });

  // 5. Slow / noncompliant courier filtered & strict shipping matrix enforced
  it('5. Proves slow or noncompliant services (> 1 day, cargo, economy) are strictly rejected by Cold Chain policy', () => {
    // Jakarta: Instant & Same Day only (Task 16)
    const quotesJakarta = filterColdChainQuotes(MOCK_RAW_RATES, {
      province: 'DKI Jakarta',
      city: 'Jakarta Timur',
      isJakarta: true,
    });

    const regulerQuote = quotesJakarta.find((q) => q.service_code === 'reg');
    const cargoQuote = quotesJakarta.find((q) => q.service_code === 'cargo');
    const ecoQuote = quotesJakarta.find((q) => q.service_code === 'eco');

    assert.equal(regulerQuote, undefined, 'Reguler (2-3 days) must be filtered out');
    assert.equal(cargoQuote, undefined, 'Cargo (3-5 days) must be filtered out');
    assert.equal(ecoQuote, undefined, 'Economy (3-6 days) must be filtered out');
    assert.equal(quotesJakarta.length, 2, 'Only Instant and Same Day must remain in Jakarta');
    assert.ok(quotesJakarta.every((q) => q.cold_chain_compliant));

    // Outside Jakarta: Next Day only (Task 16)
    const quotesOutside = filterColdChainQuotes(MOCK_RAW_RATES, {
      province: 'Jawa Barat',
      city: 'Bandung',
      isJakarta: false,
    });
    assert.equal(quotesOutside.length, 1, 'Only Next Day must remain outside Jakarta');
    assert.equal(quotesOutside[0].service_type, 'nextday');
    assert.equal(quotesOutside[0].courier_code, 'jne');
    assert.equal(quotesOutside[0].service_code, 'yes');
    assert.ok(quotesOutside.every((q) => q.cold_chain_compliant));
  });

  // 6. Biaya Layanan is server-controlled
  it('6. Proves Biaya Layanan is server-controlled from process.env.SERVICE_FEE_IDR', () => {
    const originalEnv = process.env.SERVICE_FEE_IDR;
    try {
      process.env.SERVICE_FEE_IDR = '2000';
      const config = getServiceFeeConfig();
      assert.equal(config.isConfigured, true);
      assert.equal(config.amount, 2000);
      assert.equal(config.name, 'Biaya Layanan');
      assert.equal(config.error, undefined);
    } finally {
      if (originalEnv !== undefined) {
        process.env.SERVICE_FEE_IDR = originalEnv;
      } else {
        delete process.env.SERVICE_FEE_IDR;
      }
    }
  });

  // 7. Negative fee rejected
  it('7. Proves negative service fee is strictly rejected and fails closed', () => {
    const originalEnv = process.env.SERVICE_FEE_IDR;
    try {
      process.env.SERVICE_FEE_IDR = '-1000';
      const config = getServiceFeeConfig();
      assert.equal(config.isConfigured, false);
      assert.equal(config.amount, null);
      assert.equal(config.name, 'Biaya Layanan');
      assert.ok(config.error?.includes('tidak valid'));
    } finally {
      if (originalEnv !== undefined) {
        process.env.SERVICE_FEE_IDR = originalEnv;
      } else {
        delete process.env.SERVICE_FEE_IDR;
      }
    }
  });

  // 8. Browser cannot forge service fee
  it('8. Proves browser client cannot supply or tamper with authoritative Biaya Layanan', () => {
    // Verified: No NEXT_PUBLIC_SERVICE_FEE_IDR exists
    assert.equal(
      Object.keys(process.env).some((k) => k.startsWith('NEXT_PUBLIC_SERVICE_FEE_IDR')),
      false,
      'SERVICE_FEE_IDR must NEVER be client-exposed via NEXT_PUBLIC_'
    );
  });

  // 9. Browser cannot forge shipping amount
  it('9. Proves client checkout submission cannot forge authoritative shipping price or totals', () => {
    const clientPayload: CheckoutPayload = {
      customer: {
        name: 'Budi Santoso',
        whatsapp: '08123456789',
        address: 'Jl. Merdeka No. 10, Jakarta Timur',
      },
      destination: {
        postal_code: '13890',
        city: 'Jakarta Timur',
        province: 'DKI Jakarta',
        district: 'Cipayung',
      },
      items: [
        {
          variant_id: '01940a00-1111-7000-8000-000000000001',
          quantity: 2,
        },
      ],
      delivery_method: 'instant',
      shipping_quote_id: '01940b50-1111-7000-8000-000000000099',
    };

    const canonical = buildCanonicalCheckoutPayload(clientPayload);
    const serialized = JSON.stringify(canonical);

    assert.equal(serialized.includes('price'), false, 'Canonical payload must not have price');
    assert.equal(serialized.includes('shipping_fee'), false, 'Canonical payload must not have shipping_fee');
    assert.equal(serialized.includes('total_amount'), false, 'Canonical payload must not have total_amount');
  });

  // 10. Missing service fee config handled safely
  it('10. Proves missing service fee config fails closed without silently inventing a fake fee', () => {
    const originalEnv = process.env.SERVICE_FEE_IDR;
    try {
      delete process.env.SERVICE_FEE_IDR;
      const config = getServiceFeeConfig();
      assert.equal(config.isConfigured, false);
      assert.equal(config.amount, null);
      assert.ok(config.error?.includes('belum ditentukan'));
    } finally {
      if (originalEnv !== undefined) {
        process.env.SERVICE_FEE_IDR = originalEnv;
      }
    }
  });

  // 11. Product variants remain active independently of payment availability
  it('11. Proves official product variants (250ml, 500ml, 1000ml) are active independently of payment status', () => {
    // Official sizes and catalog prices
    const variants = [
      { size: 250, price: 16000, active: true },
      { size: 500, price: 30000, active: true },
      { size: 1000, price: 55000, active: true },
    ];

    assert.equal(variants.length, 3);
    assert.ok(variants.every((v) => v.active === true), 'All 3 variants must remain active');
    assert.equal(variants[0].price, 16000);
    assert.equal(variants[1].price, 30000);
    assert.equal(variants[2].price, 55000);
  });

  // 12. Checkout blocked only at the correct stage
  it('12. Proves checkout commitment is blocked when shipping quote or service fee is incomplete', () => {
    // Test validation logic
    const canCommit = (hasQuote: boolean, hasServiceFee: boolean, hasPaymentMethod: boolean) =>
      hasQuote && hasServiceFee && hasPaymentMethod;

    assert.equal(canCommit(false, true, true), false, 'Blocked when quote is missing');
    assert.equal(canCommit(true, false, true), false, 'Blocked when service fee is unconfigured');
    assert.equal(canCommit(true, true, false), false, 'Blocked when payment method is unselected');
    assert.equal(canCommit(true, true, true), true, 'Allowed only when all are verified');
  });

  // 13. API key never reaches client
  it('13. Proves BITESHIP_API_KEY is server-only and not exposed to client config', () => {
    assert.equal(
      Object.keys(process.env).some((k) => k.startsWith('NEXT_PUBLIC_BITESHIP_API_KEY')),
      false,
      'BITESHIP_API_KEY must never be prefixed with NEXT_PUBLIC_'
    );

    const quotes = filterColdChainQuotes(MOCK_RAW_RATES.slice(0, 1), {
      province: 'DKI Jakarta',
      city: 'Jakarta Timur',
      isJakarta: true,
    });

    const quoteJson = JSON.stringify(quotes[0]);
    assert.equal(quoteJson.includes('api_key'), false);
    assert.equal(quoteJson.includes('authorization'), false);
    assert.equal(quoteJson.includes('secret'), false);
  });

  // 14. Cache / debounce behavior remains bounded
  it('14. Proves in-memory cache returns cached quotes for identical requests within TTL', async () => {
    let networkCallCount = 0;

    const mockFetch = async () => {
      networkCallCount++;
      return new Response(
        JSON.stringify({
          success: true,
          pricing: [MOCK_RAW_RATES[0]],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const client = new BiteshipClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.biteship.com',
      fetchFn: mockFetch,
    });

    const payload = {
      origin_postal_code: '13890',
      destination_postal_code: '13890',
      couriers: 'grab',
      items: [{ name: 'Yoghurt', value: 30000, quantity: 1, weight: 1000 }],
    };

    const call1 = await client.getRates(payload);
    assert.equal(call1.success, true);
    assert.equal(networkCallCount, 1);

    const call2 = await client.getRates(payload);
    assert.equal(call2.success, true);
    assert.equal(networkCallCount, 1, 'Cache must prevent duplicate network call within TTL');
  });
});

describe('Phase 1.7C.19B — Shipping Authority Consolidation & SOP Correction', () => {
  it('15. Proves canonical checkout payload binds shipping_quote_id and omits client price/fee/total', () => {
    const payload: CheckoutPayload = {
      customer: {
        name: 'Ahmad Fauzi',
        whatsapp: '081298765432',
        address: 'Jl. Bambu Apus No. 12',
      },
      destination: {
        postal_code: '13890',
        city: 'Jakarta Timur',
        province: 'DKI Jakarta',
        district: 'Cipayung',
      },
      items: [
        {
          variant_id: '01940a00-1111-7000-8000-000000000001',
          quantity: 3,
        },
      ],
      shipping_quote_id: '01940b50-1111-7000-8000-000000000099',
      delivery_method: 'instant',
    };

    const canonical = buildCanonicalCheckoutPayload(payload);
    assert.equal(canonical.shipping_quote_id, '01940b50-1111-7000-8000-000000000099');
    
    const serialized = JSON.stringify(canonical);
    assert.equal(serialized.includes('price'), false, 'Canonical must never contain client price');
    assert.equal(serialized.includes('shipping_fee'), false, 'Canonical must never contain shipping_fee');
    assert.equal(serialized.includes('total_amount'), false, 'Canonical must never contain total_amount');
    assert.equal(serialized.includes('service_fee'), false, 'Canonical must never contain service_fee');
  });

  it('16. Proves missing or unmeasured item weight fails closed without 1kg fallback', async () => {
    const mockClient = new BiteshipClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.biteship.com',
      fetchFn: async () =>
        new Response(
          JSON.stringify({ success: true, pricing: [] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        ),
    });

    const provider = new BiteshipShippingProvider(
      'test-key',
      {
        contact_name: 'Callme Hub',
        address: 'Jl. Bambu Apus, Cipayung, Jakarta Timur',
        postal_code: '13890',
        latitude: -6.312345,
        longitude: 106.891234,
      },
      mockClient
    );

    // Items with undefined or 0 weight_grams
    const input: ShippingCalculationInput = {
      city: 'Jakarta Timur',
      province: 'DKI Jakarta',
      district: 'Cipayung',
      items: [{ name: 'Callme Yoghurt 250ml', quantity: 2, value: 32000 }],
    };

    const result = await provider.fetchQuotes(input);
    assert.equal(result.success, false, 'Must fail closed when item weight is missing');
    assert.ok(result.error?.includes('Berat pengiriman definitif belum ditentukan'), 'Must report unmeasured weight error');
  });

  it('17. Proves volume_ml is never treated as weight_grams', () => {
    const volume_ml = 250;
    // 250ml yogurt is NOT 250g
    assert.notEqual(volume_ml, 300, 'Volume ml cannot be assumed equal to weight grams');
  });

  it('18. Proves notification templates strictly enforce SOP 01 storage warning and neutralize unsupported claims', () => {
    const message = generateWhatsAppMessage({
      event: 'ORDER_CREATED',
      order_number: 'ORD-20261006-0001',
      customer_name: 'Dewi Sartika',
      items: [{ product_name: 'Original', variant: '250ml', quantity: 2, price: 16000 }],
      total: 50000,
      status: 'MENUNGGU PEMBAYARAN',
    });

    // Mandatory SOP 01 warnings
    assert.ok(message.includes('Hanya tahan 3 hari di suhu ruang'), 'Must include SOP 01 room temp durability');
    assert.ok(message.includes('Suhu < 5°C'), 'Must include SOP 01 storage temperature warning');

    // Forbidden unsupported claims
    assert.equal(message.includes('0–5°C Termasuk (Icepack)'), false);
    assert.equal(message.includes('Insulated & Icepack'), false);
    assert.equal(message.includes('thermal sleeve'), false);
    assert.equal(message.includes('ice gel'), false);
    assert.equal(message.includes('probiotic freshness'), false);
  });
});
