import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseNetContentMl, isUuid, type PublicCatalogVariant } from "../../src/lib/catalog.ts";
import { toTransactionProjection, type CartItem } from "../../src/store/cartStore.ts";
import {
  buildCanonicalCheckoutPayload,
  executeCheckoutSubmission,
  validateCheckoutBffResponse,
  type CheckoutPayload,
} from "../../src/lib/checkout-client.ts";

describe("Phase 1.7C.2 — Storefront Data & Transaction Integrity", () => {
  // A. Actual ERP Variant & Net Content parsing
  it("A & B: proves 250, 500, 1000 net content quantities map to correct size categories", () => {
    const rawVariants = [
      {
        variant_id: "01940a00-1111-7000-8000-000000000001",
        sku: "CY-PLAIN-250",
        name: "Plain Pure Original 250ml",
        net_content: { quantity: "250.000000", uom: "ML" },
        price: { currency: "IDR", amount: 16000 },
      },
      {
        variant_id: "01940a00-2222-7000-8000-000000000002",
        sku: "CY-PLAIN-500",
        name: "Plain Pure Original 500ml",
        net_content: { quantity: "500.000000", uom: "ML" },
        price: { currency: "IDR", amount: 30000 },
      },
      {
        variant_id: "01940a00-3333-7000-8000-000000000003",
        sku: "CY-PLAIN-1000",
        name: "Plain Pure Original 1000ml",
        net_content: { quantity: "1000.000000", uom: "ML" },
        price: { currency: "IDR", amount: 55000 },
      },
    ];

    const v250 = rawVariants.find(
      (v) => parseNetContentMl(v.net_content.quantity, v.net_content.uom) === 250
    );
    const v500 = rawVariants.find(
      (v) => parseNetContentMl(v.net_content.quantity, v.net_content.uom) === 500
    );
    const v1000 = rawVariants.find(
      (v) => parseNetContentMl(v.net_content.quantity, v.net_content.uom) === 1000
    );

    assert.ok(v250, "Variant 250ml must resolve");
    assert.equal(v250.variant_id, "01940a00-1111-7000-8000-000000000001");
    assert.equal(v250.price.amount, 16000);

    assert.ok(v500, "Variant 500ml must resolve");
    assert.equal(v500.variant_id, "01940a00-2222-7000-8000-000000000002");
    assert.equal(v500.price.amount, 30000);

    assert.ok(v1000, "Variant 1000ml must resolve");
    assert.equal(v1000.variant_id, "01940a00-3333-7000-8000-000000000003");
    assert.equal(v1000.price.amount, 55000);
  });

  // C. Cart transaction projection contains ONLY variant_id and quantity
  it("C: proves cart transaction projection contains strictly variant_id and quantity", () => {
    const cartItems: CartItem[] = [
      {
        variant_id: "01940a00-1111-7000-8000-000000000001",
        sku: "CY-PLAIN-250",
        name: "Plain Pure Original 250ml",
        volume_ml: 250,
        quantity: 3,
        display_price: 16000,
      },
      {
        variant_id: "01940a00-2222-7000-8000-000000000002",
        sku: "CY-PLAIN-500",
        name: "Plain Pure Original 500ml",
        volume_ml: 500,
        quantity: 2,
        display_price: 30000,
      },
    ];

    const projection = toTransactionProjection(cartItems);

    assert.equal(projection.length, 2);
    for (const p of projection) {
      const keys = Object.keys(p);
      assert.deepEqual(keys.sort(), ["quantity", "variant_id"]);
    }
  });

  // D. No preview-* / prod-* fabricated IDs may be sent to checkout
  it("D: proves checkout submission rejects fabricated or preview IDs", async () => {
    const fakePayload: CheckoutPayload = {
      customer: {
        name: "Budi Santoso",
        whatsapp: "08123456789",
        address: "Jl. Bambu Apus No. 10",
      },
      items: [
        {
          variant_id: "prod-plain-250", // Fabricated ID!
          quantity: 1,
        },
      ],
      delivery_method: "instant",
    };

    const result = await executeCheckoutSubmission(fakePayload);
    assert.equal(result.success, false);
    assert.ok(result.error?.includes("tidak valid") || result.error?.includes("pratinjau"));

    const previewPayload: CheckoutPayload = {
      customer: {
        name: "Budi Santoso",
        whatsapp: "08123456789",
        address: "Jl. Bambu Apus No. 10",
      },
      items: [
        {
          variant_id: "preview-stroberi-500", // Preview ID!
          quantity: 1,
        },
      ],
      delivery_method: "instant",
    };

    const previewResult = await executeCheckoutSubmission(previewPayload);
    assert.equal(previewResult.success, false);
    assert.ok(previewResult.error?.includes("tidak valid") || previewResult.error?.includes("pratinjau"));
  });

  // E. Display price is NOT included in checkout payload or canonical hash
  it("E: proves display price is strictly omitted from canonical checkout representation", () => {
    const payload: CheckoutPayload = {
      customer: {
        name: " Siti Aminah ",
        whatsapp: "081399887766",
        address: "Bambu Kuning Residence",
      },
      items: [
        {
          variant_id: "01940a00-1111-7000-8000-000000000001",
          quantity: 2,
        },
      ],
      delivery_method: "sameday",
    };

    const canonical = buildCanonicalCheckoutPayload(payload);
    const jsonStr = JSON.stringify(canonical);

    assert.equal(jsonStr.includes("price"), false, "Canonical payload must never contain 'price'");
    assert.equal(jsonStr.includes("amount"), false, "Canonical payload must never contain 'amount'");
    assert.equal(jsonStr.includes("total"), false, "Canonical payload must never contain 'total'");
  });

  // F. ERP response remains authoritative for committed total
  it("F: proves ERP response contract validates committed total from authoritative backend", () => {
    const validBffResponse = {
      success: true,
      data: {
        order_id: "01940a00-9999-7000-8000-000000000009",
        order_number: "ORD-20260925-0001",
        status: "CONFIRMED",
        total_amount: 62000, // Authoritative calculated amount by ERP
        request_id: "req-12345",
      },
    };

    const validated = validateCheckoutBffResponse(validBffResponse);
    assert.ok(validated);
    assert.equal(validated.total_amount, 62000);
    assert.equal(validated.status, "CONFIRMED");

    // Invalid non-integer or negative amount must be rejected
    const invalidAmountResponse = {
      success: true,
      data: {
        order_id: "01940a00-9999-7000-8000-000000000009",
        order_number: "ORD-20260925-0001",
        status: "CONFIRMED",
        total_amount: -500,
        request_id: "req-12345",
      },
    };
    assert.equal(validateCheckoutBffResponse(invalidAmountResponse), null);
  });
});
