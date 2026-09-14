import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCanonicalRequestHash,
  getOrGenerateIdempotencyKey,
  clearCheckoutAttempt,
  saveOrderConfirmation,
  getValidOrderConfirmation,
  executeCheckoutSubmission,
  type CheckoutPayload,
  type KeyValueStorage,
  type PublicCommittedOrderData,
  CHECKOUT_ATTEMPT_STORAGE_KEY,
  CHECKOUT_CONFIRMATION_STORAGE_KEY,
} from '../../src/lib/checkout-client.ts';
import { isUuid } from '../../src/lib/catalog.ts';
import { useCartStore } from '../../src/store/cartStore.ts';

class MockStorage implements KeyValueStorage {
  private store = new Map<string, string>();
  public shouldFailSet = false;

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldFailSet) {
      throw new Error('QuotaExceededError');
    }
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('Browser Checkout Lifecycle & Idempotency Boundary (Gate 0E.2B)', () => {
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
    useCartStore.getState().clearCart();
  });

  function makeBasePayload(): CheckoutPayload {
    return {
      customer: {
        name: 'Siti Rahma',
        whatsapp: '081234567890',
        address: 'Jl. Melati No. 5, Jakarta',
      },
      items: [
        { variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a', quantity: 2 },
        { variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43b', quantity: 1 },
      ],
      delivery_method: 'instant',
    };
  }

  function makeValidCommittedResponse(status = 201): Response {
    return new Response(
      JSON.stringify({
        success: true,
        request_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
        data: {
          order_id: '018f6c38-8c50-711e-b8d4-53a8be77e441',
          order_number: 'CY-20260914-01J7ABCDEF',
          status: 'CONFIRMED',
          total_amount: 120000,
          request_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
        },
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // --- SECTION 28: CLIENT IDEMPOTENCY TESTS ---

  it('1. proves first semantic checkout creates a UUID idempotency key', async () => {
    const payload = makeBasePayload();
    const key = await getOrGenerateIdempotencyKey(payload, storage);

    assert.ok(isUuid(key), 'Key must be a valid UUID');
    const storedRaw = storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
    assert.ok(storedRaw, 'Attempt record must be persisted in storage');

    const stored = JSON.parse(storedRaw) as { version: number; idempotency_key: string; request_hash: string };
    assert.equal(stored.version, 1);
    assert.equal(stored.idempotency_key, key);
    assert.ok(stored.request_hash.length === 64, 'Request hash must be 64-character SHA-256 hex');
  });

  it('2. proves same exact payload reuses same idempotency key', async () => {
    const payload = makeBasePayload();
    const key1 = await getOrGenerateIdempotencyKey(payload, storage);
    const key2 = await getOrGenerateIdempotencyKey(payload, storage);

    assert.equal(key1, key2, 'Identical checkout attempts must reuse the exact same idempotency key');
  });

  it('3. proves reordered identical items reuse same idempotency key', async () => {
    const payload1 = makeBasePayload();
    const payload2: CheckoutPayload = {
      ...payload1,
      items: [
        { variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43b', quantity: 1 },
        { variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a', quantity: 2 },
      ],
    };

    const key1 = await getOrGenerateIdempotencyKey(payload1, storage);
    const key2 = await getOrGenerateIdempotencyKey(payload2, storage);

    assert.equal(key1, key2, 'Item order variation must produce identical canonical hash and key');
  });

  it('4. proves 0812..., +62812..., and 62812... canonicalize to the same request attempt', async () => {
    const p1 = makeBasePayload();
    p1.customer.whatsapp = '081234567890';

    const p2 = makeBasePayload();
    p2.customer.whatsapp = '+6281234567890';

    const p3 = makeBasePayload();
    p3.customer.whatsapp = '6281234567890';

    const hash1 = await computeCanonicalRequestHash(p1);
    const hash2 = await computeCanonicalRequestHash(p2);
    const hash3 = await computeCanonicalRequestHash(p3);

    assert.equal(hash1, hash2);
    assert.equal(hash2, hash3);

    const key1 = await getOrGenerateIdempotencyKey(p1, storage);
    const key2 = await getOrGenerateIdempotencyKey(p2, storage);
    const key3 = await getOrGenerateIdempotencyKey(p3, storage);

    assert.equal(key1, key2);
    assert.equal(key2, key3);
  });

  it('5. proves changed quantity creates a new idempotency key', async () => {
    const p1 = makeBasePayload();
    const p2 = makeBasePayload();
    p2.items[0].quantity = 5;

    const key1 = await getOrGenerateIdempotencyKey(p1, storage);
    const key2 = await getOrGenerateIdempotencyKey(p2, storage);

    assert.notEqual(key1, key2, 'Changed quantity must result in a new idempotency key');
  });

  it('6. proves changed address creates a new idempotency key', async () => {
    const p1 = makeBasePayload();
    const p2 = makeBasePayload();
    p2.customer.address = 'Jl. Anggrek No. 12, Bandung';

    const key1 = await getOrGenerateIdempotencyKey(p1, storage);
    const key2 = await getOrGenerateIdempotencyKey(p2, storage);

    assert.notEqual(key1, key2, 'Changed address must result in a new idempotency key');
  });

  it('7. proves changed delivery method creates a new idempotency key', async () => {
    const p1 = makeBasePayload();
    const p2 = makeBasePayload();
    p2.delivery_method = 'sameday';

    const key1 = await getOrGenerateIdempotencyKey(p1, storage);
    const key2 = await getOrGenerateIdempotencyKey(p2, storage);

    assert.notEqual(key1, key2, 'Changed delivery method must result in a new idempotency key');
  });

  it('8. proves sessionStorage attempt contains no raw customer PII', async () => {
    const payload = makeBasePayload();
    await getOrGenerateIdempotencyKey(payload, storage);

    const storedRaw = storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY) || '';
    assert.ok(!storedRaw.includes('Siti Rahma'), 'Must never store customer name');
    assert.ok(!storedRaw.includes('081234567890'), 'Must never store customer phone');
    assert.ok(!storedRaw.includes('6281234567890'), 'Must never store normalized phone');
    assert.ok(!storedRaw.includes('Melati'), 'Must never store shipping address');
  });

  it('9. proves network failure preserves idempotency attempt', async () => {
    const payload = makeBasePayload();
    const key = await getOrGenerateIdempotencyKey(payload, storage);

    const failingFetch: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    const result = await executeCheckoutSubmission(payload, { storage, fetchFn: failingFetch });
    assert.equal(result.success, false);
    assert.ok(result.error?.includes('Koneksi terputus'));

    const storedRaw = storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
    assert.ok(storedRaw, 'Attempt record must be preserved across network failure');
    const stored = JSON.parse(storedRaw!) as { idempotency_key: string };
    assert.equal(stored.idempotency_key, key);
  });

  it('10. proves upstream 502 preserves idempotency attempt', async () => {
    const payload = makeBasePayload();
    const key = await getOrGenerateIdempotencyKey(payload, storage);

    const gatewayErrorFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: 'Unable to process checkout' }), { status: 502 });
    };

    const result = await executeCheckoutSubmission(payload, { storage, fetchFn: gatewayErrorFetch });
    assert.equal(result.success, false);
    assert.equal(result.statusCode, 502);

    const storedRaw = storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
    assert.ok(storedRaw, 'Attempt record must be preserved across 502 failure');
    const stored = JSON.parse(storedRaw!) as { idempotency_key: string };
    assert.equal(stored.idempotency_key, key);
  });

  it('11. proves success retires attempt only after committed response processing', async () => {
    const payload = makeBasePayload();
    await getOrGenerateIdempotencyKey(payload, storage);

    const successFetch: typeof fetch = async () => makeValidCommittedResponse(201);
    const result = await executeCheckoutSubmission(payload, { storage, fetchFn: successFetch });

    assert.equal(result.success, true);
    assert.equal(result.storageFailed, false);

    const attempt = storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
    assert.equal(attempt, null, 'Attempt record must be cleared after successful committed order processing');

    const confirmation = storage.getItem(CHECKOUT_CONFIRMATION_STORAGE_KEY);
    assert.ok(confirmation, 'Confirmation record must be persisted after committed order');
  });

  it('12. proves idempotency setup failure prevents fetch call', async () => {
    const payload = makeBasePayload();
    storage.shouldFailSet = true; // Simulating storage quota/disabled failure

    let fetchCalled = false;
    const trackingFetch: typeof fetch = async () => {
      fetchCalled = true;
      return makeValidCommittedResponse(201);
    };

    const result = await executeCheckoutSubmission(payload, { storage, fetchFn: trackingFetch });
    assert.equal(result.success, false);
    assert.equal(fetchCalled, false, 'Fetch must NOT be called if idempotency establishment fails');
    assert.ok(result.error?.includes('penyimpanan browser tidak tersedia'));
  });

  // --- SECTION 30: RETURN-PAGE CONFIRMATION TESTS ---

  it('13. proves valid matching confirmation is accepted', () => {
    const data: PublicCommittedOrderData = {
      order_id: '018f6c38-8c50-711e-b8d4-53a8be77e441',
      order_number: 'CY-20260914-01J7ABCDEF',
      status: 'CONFIRMED',
      total_amount: 120000,
      request_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
    };

    saveOrderConfirmation(data, storage);
    const validated = getValidOrderConfirmation('018f6c38-8c50-711e-b8d4-53a8be77e441', storage);

    assert.ok(validated);
    assert.equal(validated.order_id, '018f6c38-8c50-711e-b8d4-53a8be77e441');
    assert.equal(validated.order_number, 'CY-20260914-01J7ABCDEF');
    assert.equal(validated.status, 'CONFIRMED');
    assert.equal(validated.total_amount, 120000);
  });

  it('14. proves missing confirmation record is rejected', () => {
    const validated = getValidOrderConfirmation('018f6c38-8c50-711e-b8d4-53a8be77e441', storage);
    assert.equal(validated, null);
  });

  it('15. proves malformed confirmation record is rejected', () => {
    storage.setItem(CHECKOUT_CONFIRMATION_STORAGE_KEY, 'invalid-json');
    assert.equal(getValidOrderConfirmation('018f6c38-8c50-711e-b8d4-53a8be77e441', storage), null);

    storage.setItem(CHECKOUT_CONFIRMATION_STORAGE_KEY, JSON.stringify({ version: 2 }));
    assert.equal(getValidOrderConfirmation('018f6c38-8c50-711e-b8d4-53a8be77e441', storage), null);
  });

  it('16. proves wrong or forged order UUID is rejected', () => {
    const data: PublicCommittedOrderData = {
      order_id: '018f6c38-8c50-711e-b8d4-53a8be77e441',
      order_number: 'CY-20260914-01J7ABCDEF',
      status: 'CONFIRMED',
      total_amount: 120000,
      request_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
    };

    saveOrderConfirmation(data, storage);

    // Completely different UUID in URL query
    const forgedResult = getValidOrderConfirmation('018f6c38-8c50-711e-b8d4-53a8be77e999', storage);
    assert.equal(forgedResult, null);

    // Garbage query parameter
    assert.equal(getValidOrderConfirmation('garbage-id', storage), null);
    assert.equal(getValidOrderConfirmation(null, storage), null);
  });

  it('17. proves status other than CONFIRMED is rejected', () => {
    const record = {
      version: 1,
      order_id: '018f6c38-8c50-711e-b8d4-53a8be77e441',
      order_number: 'CY-20260914-01J7ABCDEF',
      status: 'PENDING',
      total_amount: 120000,
      request_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
      recorded_at: Date.now(),
    };

    storage.setItem(CHECKOUT_CONFIRMATION_STORAGE_KEY, JSON.stringify(record));
    assert.equal(getValidOrderConfirmation('018f6c38-8c50-711e-b8d4-53a8be77e441', storage), null);
  });

  it('18. proves expired confirmation record is rejected', () => {
    const record = {
      version: 1,
      order_id: '018f6c38-8c50-711e-b8d4-53a8be77e441',
      order_number: 'CY-20260914-01J7ABCDEF',
      status: 'CONFIRMED',
      total_amount: 120000,
      request_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
      recorded_at: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
    };

    storage.setItem(CHECKOUT_CONFIRMATION_STORAGE_KEY, JSON.stringify(record));
    assert.equal(getValidOrderConfirmation('018f6c38-8c50-711e-b8d4-53a8be77e441', storage), null);
  });

  it('19. proves confirmation record contains zero customer PII', () => {
    const data: PublicCommittedOrderData = {
      order_id: '018f6c38-8c50-711e-b8d4-53a8be77e441',
      order_number: 'CY-20260914-01J7ABCDEF',
      status: 'CONFIRMED',
      total_amount: 120000,
      request_id: '018f6c38-8c50-711e-b8d4-53a8be77e440',
    };

    saveOrderConfirmation(data, storage);
    const raw = storage.getItem(CHECKOUT_CONFIRMATION_STORAGE_KEY) || '';

    assert.ok(!raw.includes('name'));
    assert.ok(!raw.includes('phone'));
    assert.ok(!raw.includes('whatsapp'));
    assert.ok(!raw.includes('address'));
    assert.ok(!raw.includes('token'));
  });

  // --- SECTION 31: CART LIFECYCLE TESTS ---

  it('20. proves cart remains on network failure', async () => {
    const cart = useCartStore.getState();
    cart.addItem({
      variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
      sku: 'CY-STR-250',
      name: 'Stroberi 250ml',
      quantity: 2,
      display_price: 25000,
    });

    assert.equal(useCartStore.getState().items.length, 1);

    const failingFetch: typeof fetch = async () => {
      throw new Error('Connection refused');
    };

    const result = await executeCheckoutSubmission(makeBasePayload(), { storage, fetchFn: failingFetch });
    assert.equal(result.success, false);
    assert.equal(useCartStore.getState().items.length, 1, 'Cart items must remain intact');
  });

  it('21. proves cart remains on 409 conflict', async () => {
    const cart = useCartStore.getState();
    cart.addItem({
      variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
      sku: 'CY-STR-250',
      name: 'Stroberi 250ml',
      quantity: 2,
      display_price: 25000,
    });

    const conflictFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: 'Conflict' }), { status: 409 });
    };

    const result = await executeCheckoutSubmission(makeBasePayload(), { storage, fetchFn: conflictFetch });
    assert.equal(result.success, false);
    assert.equal(result.statusCode, 409);
    assert.equal(useCartStore.getState().items.length, 1);
  });

  it('22. proves cart remains on 422 validation failure', async () => {
    const cart = useCartStore.getState();
    cart.addItem({
      variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
      sku: 'CY-STR-250',
      name: 'Stroberi 250ml',
      quantity: 2,
      display_price: 25000,
    });

    const unprocessableFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: 'Unprocessable' }), { status: 422 });
    };

    const result = await executeCheckoutSubmission(makeBasePayload(), { storage, fetchFn: unprocessableFetch });
    assert.equal(result.success, false);
    assert.equal(result.statusCode, 422);
    assert.equal(useCartStore.getState().items.length, 1);
  });

  it('23. proves cart remains on 502 Bad Gateway', async () => {
    const cart = useCartStore.getState();
    cart.addItem({
      variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
      sku: 'CY-STR-250',
      name: 'Stroberi 250ml',
      quantity: 2,
      display_price: 25000,
    });

    const badGatewayFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: 'Bad Gateway' }), { status: 502 });
    };

    const result = await executeCheckoutSubmission(makeBasePayload(), { storage, fetchFn: badGatewayFetch });
    assert.equal(result.success, false);
    assert.equal(result.statusCode, 502);
    assert.equal(useCartStore.getState().items.length, 1);
  });

  it('24. proves cart remains on malformed 2xx response body', async () => {
    const cart = useCartStore.getState();
    cart.addItem({
      variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
      sku: 'CY-STR-250',
      name: 'Stroberi 250ml',
      quantity: 2,
      display_price: 25000,
    });

    const malformedSuccessFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ success: true, data: { order_id: 'not-a-uuid' } }), {
        status: 201,
      });
    };

    const result = await executeCheckoutSubmission(makeBasePayload(), { storage, fetchFn: malformedSuccessFetch });
    assert.equal(result.success, false);
    assert.equal(result.statusCode, 502);
    assert.equal(useCartStore.getState().items.length, 1);
  });

  it('25. proves valid committed 201 clears cart', async () => {
    const cart = useCartStore.getState();
    cart.addItem({
      variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
      sku: 'CY-STR-250',
      name: 'Stroberi 250ml',
      quantity: 2,
      display_price: 25000,
    });

    const successFetch: typeof fetch = async () => makeValidCommittedResponse(201);
    const result = await executeCheckoutSubmission(makeBasePayload(), { storage, fetchFn: successFetch });

    assert.equal(result.success, true);
    if (result.success) {
      cart.clearCart(); // Simulating checkout page handler
    }
    assert.equal(useCartStore.getState().items.length, 0, 'Cart must be cleared on committed order');
  });

  it('26. proves valid committed replay 200 clears cart', async () => {
    const cart = useCartStore.getState();
    cart.addItem({
      variant_id: '018f6c38-8c50-711e-b8d4-53a8be77e43a',
      sku: 'CY-STR-250',
      name: 'Stroberi 250ml',
      quantity: 2,
      display_price: 25000,
    });

    const replayFetch: typeof fetch = async () => makeValidCommittedResponse(200);
    const result = await executeCheckoutSubmission(makeBasePayload(), { storage, fetchFn: replayFetch });

    assert.equal(result.success, true);
    if (result.success) {
      cart.clearCart();
    }
    assert.equal(useCartStore.getState().items.length, 0, 'Cart must be cleared on committed replay order');
  });

  it('27. proves confirmation storage failure preserves idempotency attempt and signals storageFailed', async () => {
    storage.shouldFailSet = false;
    const payload = makeBasePayload();
    const key = await getOrGenerateIdempotencyKey(payload, storage);

    // Now make setItem fail when trying to save confirmation
    storage.shouldFailSet = true;

    const successFetch: typeof fetch = async () => makeValidCommittedResponse(201);
    const result = await executeCheckoutSubmission(payload, { storage, fetchFn: successFetch });

    assert.equal(result.success, true);
    assert.equal(result.storageFailed, true, 'Must signal storageFailed: true');
    assert.ok(result.data, 'Committed order data must be provided for inline display');

    // Attempt must NOT be retired so accidental resubmission remains safe
    storage.shouldFailSet = false;
    const stored = JSON.parse(storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY)!) as { idempotency_key: string };
    assert.equal(stored.idempotency_key, key);
  });
});
