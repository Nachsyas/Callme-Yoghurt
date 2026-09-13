import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../../src/app/api/catalog/route.ts';
import { parsePublicCatalogResponse } from '../../src/lib/catalog.ts';
import { useCartStore, toTransactionProjection, type CartItem } from '../../src/store/cartStore.ts';

describe('Authoritative Storefront Catalog & Cart Identity (Gate 0E.2A)', () => {
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
              variant_id: '11111111-2222-3333-4444-555555555555',
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
              variant_id: '66666666-7777-8888-9999-000000000000',
              sku: 'CY-STR-1000',
              name: 'Stroberi 1 Liter',
              net_content: {
                quantity: '1000.000000',
                uom: 'ML',
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
    assert.strictEqual(v1.variant_id, '11111111-2222-3333-4444-555555555555');
    assert.strictEqual(v1.sku, 'CY-STR-250');
    assert.strictEqual(v1.name, 'Stroberi 250ml');
    assert.strictEqual(v1.price.currency, 'IDR');
    assert.strictEqual(v1.price.amount, 25000);
    assert.strictEqual(v1.net_content?.quantity, '250.000000');
    assert.strictEqual(v1.net_content?.uom, 'ML');
  });

  // 2. Malformed catalog rejected
  it('proves malformed catalog rejected', () => {
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
                variant_id: 'uuid-1',
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
                variant_id: 'uuid-1',
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

    // Missing variant_id
    assert.strictEqual(
      parsePublicCatalogResponse({
        products: [
          {
            slug: 'stroberi',
            name: 'Stroberi',
            variants: [
              {
                sku: 'CY-STR-250',
                name: 'Stroberi',
                price: { currency: 'IDR', amount: 25000 },
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

  // 3. Missing ERP config fails closed
  it('proves missing ERP config fails closed with HTTP 503', async () => {
    delete process.env.ERP_INTERNAL_URL;
    delete process.env.ERP_SERVICE_TOKEN;

    const res = await GET();
    assert.strictEqual(res.status, 503);

    const body = await res.json();
    assert.strictEqual(body.error, 'Catalog service is temporarily unavailable');
    assert.strictEqual(res.headers.get('Cache-Control'), 'no-store');
  });

  // 4. Service credentials never appear publicly
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

  // 5. Catalog includes real variant_id
  it('proves catalog includes real variant_id', () => {
    const raw = makeValidUpstreamCatalog();
    const parsed = parsePublicCatalogResponse(raw);

    assert.ok(parsed);
    const expectedUuid = '11111111-2222-3333-4444-555555555555';
    assert.strictEqual(parsed.products[0].variants[0].variant_id, expectedUuid);
    assert.match(
      parsed.products[0].variants[0].variant_id,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  // 6. Cart identity uses variant_id
  it('proves cart identity uses variant_id and removes correctly by variant_id', () => {
    const store = useCartStore.getState();

    const item1: CartItem = {
      variant_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      sku: 'CY-STR-250',
      name: 'Callme Yoghurt Stroberi',
      volume_ml: 250,
      quantity: 2,
      display_price: 25000,
    };

    store.addItem(item1);

    const items = useCartStore.getState().items;
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].variant_id, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    assert.strictEqual(items[0].sku, 'CY-STR-250');
    assert.strictEqual(items[0].display_price, 25000);

    // Remove by variant_id
    useCartStore.getState().removeItem('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
    assert.strictEqual(useCartStore.getState().items.length, 0);
  });

  // 7. Same variant_id merges quantity
  it('proves same variant_id merges quantity', () => {
    const store = useCartStore.getState();

    const itemA: CartItem = {
      variant_id: 'b1ffcd88-8b1a-4fe7-aa5c-5aa8ac270b22',
      sku: 'CY-MAN-250',
      name: 'Callme Yoghurt Mangga',
      volume_ml: 250,
      quantity: 2,
      display_price: 28000,
    };

    const itemB: CartItem = {
      variant_id: 'b1ffcd88-8b1a-4fe7-aa5c-5aa8ac270b22',
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

  // 8. Checkout item projection contains only variant_id and quantity
  it('proves checkout item projection contains only variant_id and quantity', () => {
    const cartItems: CartItem[] = [
      {
        variant_id: 'var-uuid-1',
        sku: 'CY-STR-250',
        name: 'Stroberi 250ml',
        volume_ml: 250,
        quantity: 3,
        display_price: 25000,
      },
      {
        variant_id: 'var-uuid-2',
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

    assert.strictEqual(projection[0].variant_id, 'var-uuid-1');
    assert.strictEqual(projection[0].quantity, 3);
    assert.strictEqual(projection[1].variant_id, 'var-uuid-2');
    assert.strictEqual(projection[1].quantity, 1);
  });

  // 9. display_price is not part of transaction projection
  it('proves display_price is not part of transaction projection', () => {
    const cartItems: CartItem[] = [
      {
        variant_id: 'var-uuid-xyz',
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
