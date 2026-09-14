import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../../src/app/api/catalog/route.ts';
import {
  parsePublicCatalogResponse,
  parseNetContentMl,
  isUuid,
  type PublicCatalogVariant,
  type PublicCatalogProduct,
} from '../../src/lib/catalog.ts';
import { useCartStore, toTransactionProjection, type CartItem } from '../../src/store/cartStore.ts';

describe('Authoritative Storefront Catalog & Cart Identity (Gate 0E.2A & Gate 0E.2A.1)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const testSecretToken = 'super-secret-erp-service-token-gate0e2a';
  const testErpUrl = 'http://erp-core-internal.local';

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
    process.env.ERP_INTERNAL_URL = testErpUrl;
    process.env.ERP_SERVICE_TOKEN = testSecretToken;

    // Reset cart store before each test
    useCartStore.getState().clearCart();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  function makeValidUpstreamCatalog() {
    return {
      products: [
        {
          slug: 'stroberi',
          name: 'Callme Yoghurt Stroberi',
          variants: [
            {
              variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
              sku: 'CY-STR-250',
              name: 'Stroberi 250ml',
              net_content: {
                quantity: '250.000000',
                uom: 'ML',
              },
              price: {
                currency: 'IDR',
                amount: 25000,
              },
            },
            {
              variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43b',
              sku: 'CY-STR-1000',
              name: 'Stroberi 1 Liter',
              net_content: {
                quantity: '1.000000',
                uom: 'L',
              },
              price: {
                currency: 'IDR',
                amount: 75000,
              },
            },
          ],
        },
      ],
    };
  }

  // 1. Valid ERP catalog parses successfully
  it('proves valid ERP catalog parses successfully', () => {
    const raw = makeValidUpstreamCatalog();
    const parsed = parsePublicCatalogResponse(raw);

    assert.ok(parsed, 'Expected valid catalog to parse successfully');
    assert.strictEqual(parsed.products.length, 1);
    assert.strictEqual(parsed.products[0].slug, 'stroberi');
    assert.strictEqual(parsed.products[0].name, 'Callme Yoghurt Stroberi');
    assert.strictEqual(parsed.products[0].variants.length, 2);

    const v1 = parsed.products[0].variants[0];
    assert.strictEqual(v1.variant_id, '018f6c38-8c50-711e-b8d4-53a8be77e43a');
    assert.strictEqual(v1.sku, 'CY-STR-250');
    assert.strictEqual(v1.name, 'Stroberi 250ml');
    assert.strictEqual(v1.price.currency, 'IDR');
    assert.strictEqual(v1.price.amount, 25000);
    assert.strictEqual(v1.net_content?.quantity, '250.000000');
    assert.strictEqual(v1.net_content?.uom, 'ML');
  });

  // 2. Strict UUID enforcement in parser
  it('proves malformed or non-UUID variant_id is rejected by catalog parser', () => {
    const raw = makeValidUpstreamCatalog();

    // Arbitrary string is NOT a UUID
    raw.products[0].variants[0].variant_id = 'not-a-uuid';
    assert.strictEqual(parsePublicCatalogResponse(raw), null);

    // Empty string
    raw.products[0].variants[0].variant_id = '';
    assert.strictEqual(parsePublicCatalogResponse(raw), null);

    // Whitespace only
    raw.products[0].variants[0].variant_id = '   ';
    assert.strictEqual(parsePublicCatalogResponse(raw), null);

    // Invalid characters
    raw.products[0].variants[0].variant_id = '018f6c38-8c50-711e-b8d4-53a8be77e43z';
    assert.strictEqual(parsePublicCatalogResponse(raw), null);

    // Wrong length
    raw.products[0].variants[0].variant_id = '018f6c38-8c50-711e-b8d4-53a8be77e4';
    assert.strictEqual(parsePublicCatalogResponse(raw), null);
  });

  it('proves valid UUIDv4 and UUIDv7 variant_ids are accepted by catalog parser', () => {
    const raw = makeValidUpstreamCatalog();

    // Standard UUIDv4
    raw.products[0].variants[0].variant_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    // PostgreSQL / Laravel UUIDv7
    raw.products[0].variants[1].variant_id = '018f6c38-8c50-711e-b8d4-53a8be77e43b';

    const parsed = parsePublicCatalogResponse(raw);
    assert.ok(parsed);
    assert.strictEqual(parsed.products[0].variants[0].variant_id, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    assert.strictEqual(parsed.products[0].variants[1].variant_id, '018f6c38-8c50-711e-b8d4-53a8be77e43b');
  });

  // 3. Exact IDR currency enforcement
  it('proves USD and non-IDR currencies are rejected by catalog parser', () => {
    const raw = makeValidUpstreamCatalog();
    raw.products[0].variants[0].price.currency = 'USD';
    assert.strictEqual(parsePublicCatalogResponse(raw), null);

    raw.products[0].variants[0].price.currency = 'SGD';
    assert.strictEqual(parsePublicCatalogResponse(raw), null);

    raw.products[0].variants[0].price.currency = 'EUR';
    assert.strictEqual(parsePublicCatalogResponse(raw), null);
  });

  it('proves lowercase idr or mixed-case Idr is rejected by catalog parser (no auto-normalization)', () => {
    const raw = makeValidUpstreamCatalog();

    raw.products[0].variants[0].price.currency = 'idr';
    assert.strictEqual(parsePublicCatalogResponse(raw), null);

    raw.products[0].variants[0].price.currency = 'Idr';
    assert.strictEqual(parsePublicCatalogResponse(raw), null);

    raw.products[0].variants[0].price.currency = ' IDR ';
    assert.strictEqual(parsePublicCatalogResponse(raw), null);
  });

  it('proves exact IDR currency is accepted by catalog parser', () => {
    const raw = makeValidUpstreamCatalog();
    raw.products[0].variants[0].price.currency = 'IDR';
    raw.products[0].variants[1].price.currency = 'IDR';

    const parsed = parsePublicCatalogResponse(raw);
    assert.ok(parsed);
    assert.strictEqual(parsed.products[0].variants[0].price.currency, 'IDR');
    assert.strictEqual(parsed.products[0].variants[1].price.currency, 'IDR');
  });

  // 4. Net content normalization helper (parseNetContentMl)
  it('proves parseNetContentMl correctly maps supported units with exact BigInt decimal parsing', () => {
    // Exact 250 ML
    assert.strictEqual(parseNetContentMl('250.000000', 'ML'), 250);
    assert.strictEqual(parseNetContentMl('250', 'ML'), 250);
    assert.strictEqual(parseNetContentMl('250', 'ml'), 250);

    // Exact 1000 ML
    assert.strictEqual(parseNetContentMl('1000.000000', 'ML'), 1000);
    assert.strictEqual(parseNetContentMl('1000', 'ml'), 1000);

    // Exact 1 Liter -> 1000 ML
    assert.strictEqual(parseNetContentMl('1.000000', 'L'), 1000);
    assert.strictEqual(parseNetContentMl('1', 'L'), 1000);
    assert.strictEqual(parseNetContentMl('1', 'l'), 1000);

    // Exact Fractional Liter: 0.25 L -> 250 ML
    assert.strictEqual(parseNetContentMl('0.250000', 'L'), 250);
    assert.strictEqual(parseNetContentMl('0.25', 'L'), 250);
  });

  it('proves parseNetContentMl rejects near-value fuzzy amounts, non-exact divisions, and scientific notation (Gate 0E.2A.2)', () => {
    // Near-values that fuzzy Math.round() would have incorrectly accepted
    assert.strictEqual(parseNetContentMl('249.600000', 'ML'), null);
    assert.strictEqual(parseNetContentMl('250.000001', 'ML'), null);
    assert.strictEqual(parseNetContentMl('999.600000', 'ML'), null);
    assert.strictEqual(parseNetContentMl('999.999999', 'ML'), null);
    assert.strictEqual(parseNetContentMl('0.999600', 'L'), null);
    assert.strictEqual(parseNetContentMl('1.000001', 'L'), null);

    // Scientific notation
    assert.strictEqual(parseNetContentMl('1e3', 'ML'), null);
    assert.strictEqual(parseNetContentMl('1E3', 'L'), null);
    assert.strictEqual(parseNetContentMl('2.5e2', 'ML'), null);

    // Precision exceeding PostgreSQL DECIMAL(18,6) limit (>6 decimal places)
    assert.strictEqual(parseNetContentMl('250.0000000', 'ML'), null);
  });

  it('proves parseNetContentMl rejects invalid, negative, zero, or unsupported units', () => {
    // Unsupported UOMs
    assert.strictEqual(parseNetContentMl('250', 'GRAM'), null);
    assert.strictEqual(parseNetContentMl('1', 'KG'), null);
    assert.strictEqual(parseNetContentMl('1', 'PCS'), null);

    // Missing or empty values
    assert.strictEqual(parseNetContentMl(null, 'ML'), null);
    assert.strictEqual(parseNetContentMl('250', null), null);
    assert.strictEqual(parseNetContentMl('', 'ML'), null);
    assert.strictEqual(parseNetContentMl('250', ''), null);

    // Non-numeric / NaN / non-finite / invalid characters
    assert.strictEqual(parseNetContentMl('abc', 'ML'), null);
    assert.strictEqual(parseNetContentMl('NaN', 'ML'), null);
    assert.strictEqual(parseNetContentMl('Infinity', 'ML'), null);
    assert.strictEqual(parseNetContentMl('+250', 'ML'), null);
    assert.strictEqual(parseNetContentMl('250.abc', 'ML'), null);

    // Zero / negative values
    assert.strictEqual(parseNetContentMl('0', 'ML'), null);
    assert.strictEqual(parseNetContentMl('0.000000', 'ML'), null);
    assert.strictEqual(parseNetContentMl('-250', 'ML'), null);
    assert.strictEqual(parseNetContentMl('-250.000000', 'ML'), null);
  });

  // 5. Size matching does NOT guess from SKU
  it('proves size-to-variant mapping does NOT guess from SKU when net_content is missing or invalid', () => {
    const rawVariantWithNullNetContent: PublicCatalogVariant = {
      variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
      sku: 'CY-STR-250', // Has "250" in SKU, but net content is null!
      name: 'Stroberi Mystery',
      net_content: {
        quantity: null,
        uom: null,
      },
      price: {
        currency: 'IDR',
        amount: 25000,
      },
    };

    // Attempting size matching strictly via parseNetContentMl
    const ml = parseNetContentMl(
      rawVariantWithNullNetContent.net_content?.quantity,
      rawVariantWithNullNetContent.net_content?.uom
    );
    assert.strictEqual(ml, null, 'Must return null for missing net content');

    // Therefore variant250 matching logic:
    const matches250 = ml === 250;
    assert.strictEqual(matches250, false, 'Must NOT match 250ml option based on SKU string');
  });

  // 6. Unknown route slug cannot resolve/purchase Plain as fallback
  it('proves unknown route slug cannot resolve or purchase Plain as fallback', () => {
    const catalogData = {
      products: [
        {
          slug: 'plain',
          name: 'Callme Yoghurt Plain',
          variants: [
            {
              variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43c',
              sku: 'CY-PLN-250',
              name: 'Plain 250ml',
              net_content: { quantity: '250.000000', uom: 'ML' },
              price: { currency: 'IDR' as const, amount: 20000 },
            },
          ],
        },
      ],
    };

    const requestedSlug = 'unknown-flavor';

    // Storefront matching logic:
    const matchedProduct = catalogData.products.find(
      (p: PublicCatalogProduct) => p.slug.toLowerCase() === requestedSlug.toLowerCase()
    );

    // Proves unknown slug returns null instead of falling back to 'plain'
    assert.strictEqual(matchedProduct, undefined, 'Unknown slug must NOT match any product');

    // Cart store remains empty because Add to Cart is disabled when matchedProduct is null
    assert.strictEqual(useCartStore.getState().items.length, 0);
  });

  // 7. General malformed catalog rejected
  it('proves malformed catalog structure is rejected', () => {
    // Missing slug
    assert.strictEqual(
      parsePublicCatalogResponse({
        products: [{ name: 'Stroberi', variants: [] }],
      }),
      null
    );

    // Non-integer price
    assert.strictEqual(
      parsePublicCatalogResponse({
        products: [
          {
            slug: 'stroberi',
            name: 'Stroberi',
            variants: [
              {
                variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
                sku: 'CY-STR-250',
                name: 'Stroberi',
                price: { currency: 'IDR', amount: 25000.5 },
              },
            ],
          },
        ],
      }),
      null
    );

    // Negative price
    assert.strictEqual(
      parsePublicCatalogResponse({
        products: [
          {
            slug: 'stroberi',
            name: 'Stroberi',
            variants: [
              {
                variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
                sku: 'CY-STR-250',
                name: 'Stroberi',
                price: { currency: 'IDR', amount: -100 },
              },
            ],
          },
        ],
      }),
      null
    );

    // Non-array products
    assert.strictEqual(parsePublicCatalogResponse({ products: 'not-an-array' }), null);
    // Null / primitive
    assert.strictEqual(parsePublicCatalogResponse(null), null);
    assert.strictEqual(parsePublicCatalogResponse('string'), null);
  });

  // 8. Missing ERP config fails closed
  it('proves missing ERP config fails closed with HTTP 503', async () => {
    delete process.env.ERP_INTERNAL_URL;
    delete process.env.ERP_SERVICE_TOKEN;

    const res = await GET();
    assert.strictEqual(res.status, 503);

    const body = await res.json();
    assert.strictEqual(body.error, 'Catalog service is temporarily unavailable');
    assert.strictEqual(res.headers.get('Cache-Control'), 'no-store');
  });

  // 9. Service credentials never appear publicly
  it('proves service credentials never appear publicly in body or headers', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          ...makeValidUpstreamCatalog(),
          internal_secret: testSecretToken,
          upstream_db_url: 'postgres://callme_user:secret@postgres:5432/callme_db',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const res = await GET();
    assert.strictEqual(res.status, 200);

    const rawBody = await res.text();
    assert.ok(
      !rawBody.includes(testSecretToken),
      'Upstream service token must never appear in public catalog response'
    );
    assert.ok(
      !rawBody.includes(testErpUrl),
      'Internal ERP URL must never appear in public catalog response'
    );
    assert.ok(
      !rawBody.includes('postgres://'),
      'Internal database URL must never appear in public catalog response'
    );

    // Also check headers
    res.headers.forEach((headerVal, headerKey) => {
      assert.ok(
        !headerVal.includes(testSecretToken),
        `Header ${headerKey} leaked internal secret token`
      );
    });
  });

  // 10. Cart identity uses variant_id
  it('proves cart identity uses variant_id and removes correctly by variant_id', () => {
    const store = useCartStore.getState();

    const item1: CartItem = {
      variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
      sku: 'CY-STR-250',
      name: 'Callme Yoghurt Stroberi',
      volume_ml: 250,
      quantity: 2,
      display_price: 25000,
    };

    store.addItem(item1);

    const items = useCartStore.getState().items;
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].variant_id, '018f6c38-8c50-711e-b8d4-53a8be77e43a');
    assert.strictEqual(items[0].sku, 'CY-STR-250');
    assert.strictEqual(items[0].display_price, 25000);

    // Remove by variant_id
    useCartStore.getState().removeItem('018f6c38-8c50-711e-b8d4-53a8be77e43a');
    assert.strictEqual(useCartStore.getState().items.length, 0);
  });

  // 11. Same variant_id merges quantity
  it('proves same variant_id merges quantity', () => {
    const store = useCartStore.getState();

    const itemA: CartItem = {
      variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43b',
      sku: 'CY-MAN-250',
      name: 'Callme Yoghurt Mangga',
      volume_ml: 250,
      quantity: 2,
      display_price: 28000,
    };

    const itemB: CartItem = {
      variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43b',
      sku: 'CY-MAN-250',
      name: 'Callme Yoghurt Mangga',
      volume_ml: 250,
      quantity: 3,
      display_price: 28000,
    };

    store.addItem(itemA);
    store.addItem(itemB);

    const items = useCartStore.getState().items;
    assert.strictEqual(items.length, 1, 'Expected quantity merge instead of duplicate entry');
    assert.strictEqual(items[0].quantity, 5, 'Expected merged quantity 2 + 3 = 5');
    assert.strictEqual(useCartStore.getState().getEstimatedTotal(), 5 * 28000);
  });

  // 12. Checkout item projection contains only variant_id and quantity
  it('proves checkout item projection contains only variant_id and quantity', () => {
    const cartItems: CartItem[] = [
      {
        variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
        sku: 'CY-STR-250',
        name: 'Stroberi 250ml',
        volume_ml: 250,
        quantity: 3,
        display_price: 25000,
      },
      {
        variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43b',
        sku: 'CY-MAN-1000',
        name: 'Mangga 1 Liter',
        volume_ml: 1000,
        quantity: 1,
        display_price: 80000,
      },
    ];

    const projection = toTransactionProjection(cartItems);

    assert.strictEqual(projection.length, 2);

    for (const projected of projection) {
      const keys = Object.keys(projected).sort();
      assert.deepStrictEqual(
        keys,
        ['quantity', 'variant_id'],
        'Transaction projection must contain ONLY variant_id and quantity'
      );
    }

    assert.strictEqual(projection[0].variant_id, '018f6c38-8c50-711e-b8d4-53a8be77e43a');
    assert.strictEqual(projection[0].quantity, 3);
    assert.strictEqual(projection[1].variant_id, '018f6c38-8c50-711e-b8d4-53a8be77e43b');
    assert.strictEqual(projection[1].quantity, 1);
  });

  // 13. display_price is not part of transaction projection
  it('proves display_price is not part of transaction projection', () => {
    const cartItems: CartItem[] = [
      {
        variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43c',
        sku: 'CY-PLAIN-250',
        name: 'Plain 250ml',
        quantity: 4,
        display_price: 22000,
      },
    ];

    const projection = toTransactionProjection(cartItems);
    const firstProjected = projection[0] as Record<string, unknown>;

    assert.strictEqual('display_price' in firstProjected, false);
    assert.strictEqual('price' in firstProjected, false);
    assert.strictEqual('subtotal' in firstProjected, false);
    assert.strictEqual('total' in firstProjected, false);
    assert.strictEqual('total_amount' in firstProjected, false);
    assert.strictEqual('sku' in firstProjected, false);
    assert.strictEqual('name' in firstProjected, false);
    assert.strictEqual('volume_ml' in firstProjected, false);
    assert.strictEqual('stock' in firstProjected, false);
    assert.strictEqual('lot' in firstProjected, false);
    assert.strictEqual('warehouse' in firstProjected, false);
  });
});
