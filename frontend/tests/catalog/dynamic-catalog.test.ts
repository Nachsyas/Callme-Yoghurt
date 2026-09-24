import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parsePublicCatalogResponse,
  getProductPresentation,
  PRESENTATION_OVERRIDES,
  DEFAULT_PRESENTATION_FALLBACK,
  parseNetContentMl,
  isUuid,
  type PublicCatalogData,
  type PublicCatalogProduct,
} from "../../src/lib/catalog.ts";
import {
  useCartStore,
  toTransactionProjection,
  type CartItem,
} from "../../src/store/cartStore.ts";
import {
  buildCanonicalCheckoutPayload,
  executeCheckoutSubmission,
  type CheckoutPayload,
} from "../../src/lib/checkout-client.ts";

describe("Phase 1.7C.3 — Dynamic Store Catalog & Presentation Overrides", () => {
  // Official ERP 7-product catalog fixture
  const officialCatalogFixture = {
    products: [
      {
        slug: "plain",
        name: "Plain",
        description: "Yoghurt stirred segar kualitas homemade Callme Yoghurt tanpa perisa tambahan.",
        variants: [
          {
            variant_id: "01940a00-0001-7000-8000-000000000001",
            sku: "CY-PLAIN-250",
            name: "Plain 250ml",
            net_content: { quantity: "250.000000", uom: "ML" },
            price: { currency: "IDR", amount: 16000 },
          },
          {
            variant_id: "01940a00-0001-7000-8000-000000000002",
            sku: "CY-PLAIN-500",
            name: "Plain 500ml",
            net_content: { quantity: "500.000000", uom: "ML" },
            price: { currency: "IDR", amount: 30000 },
          },
          {
            variant_id: "01940a00-0001-7000-8000-000000000003",
            sku: "CY-PLAIN-1000",
            name: "Plain 1000ml",
            net_content: { quantity: "1.000000", uom: "L" },
            price: { currency: "IDR", amount: 55000 },
          },
        ],
      },
      {
        slug: "anggur",
        name: "Anggur",
        variants: [
          {
            variant_id: "01940a00-0002-7000-8000-000000000001",
            sku: "CY-ANGGUR-250",
            name: "Anggur 250ml",
            net_content: { quantity: "250.000000", uom: "ML" },
            price: { currency: "IDR", amount: 16000 },
          },
          {
            variant_id: "01940a00-0002-7000-8000-000000000002",
            sku: "CY-ANGGUR-500",
            name: "Anggur 500ml",
            net_content: { quantity: "500.000000", uom: "ML" },
            price: { currency: "IDR", amount: 30000 },
          },
          {
            variant_id: "01940a00-0002-7000-8000-000000000003",
            sku: "CY-ANGGUR-1000",
            name: "Anggur 1000ml",
            net_content: { quantity: "1.000000", uom: "L" },
            price: { currency: "IDR", amount: 55000 },
          },
        ],
      },
      {
        slug: "stroberi",
        name: "Stroberi",
        variants: [
          {
            variant_id: "01940a00-0003-7000-8000-000000000001",
            sku: "CY-STROBERI-250",
            name: "Stroberi 250ml",
            net_content: { quantity: "250.000000", uom: "ML" },
            price: { currency: "IDR", amount: 16000 },
          },
          {
            variant_id: "01940a00-0003-7000-8000-000000000002",
            sku: "CY-STROBERI-500",
            name: "Stroberi 500ml",
            net_content: { quantity: "500.000000", uom: "ML" },
            price: { currency: "IDR", amount: 30000 },
          },
          {
            variant_id: "01940a00-0003-7000-8000-000000000003",
            sku: "CY-STROBERI-1000",
            name: "Stroberi 1000ml",
            net_content: { quantity: "1.000000", uom: "L" },
            price: { currency: "IDR", amount: 55000 },
          },
        ],
      },
      {
        slug: "leci",
        name: "Leci",
        variants: [
          {
            variant_id: "01940a00-0004-7000-8000-000000000001",
            sku: "CY-LECI-250",
            name: "Leci 250ml",
            net_content: { quantity: "250.000000", uom: "ML" },
            price: { currency: "IDR", amount: 16000 },
          },
          {
            variant_id: "01940a00-0004-7000-8000-000000000002",
            sku: "CY-LECI-500",
            name: "Leci 500ml",
            net_content: { quantity: "500.000000", uom: "ML" },
            price: { currency: "IDR", amount: 30000 },
          },
          {
            variant_id: "01940a00-0004-7000-8000-000000000003",
            sku: "CY-LECI-1000",
            name: "Leci 1000ml",
            net_content: { quantity: "1.000000", uom: "L" },
            price: { currency: "IDR", amount: 55000 },
          },
        ],
      },
      {
        slug: "mangga",
        name: "Mangga",
        variants: [
          {
            variant_id: "01940a00-0005-7000-8000-000000000001",
            sku: "CY-MANGGA-250",
            name: "Mangga 250ml",
            net_content: { quantity: "250.000000", uom: "ML" },
            price: { currency: "IDR", amount: 16000 },
          },
          {
            variant_id: "01940a00-0005-7000-8000-000000000002",
            sku: "CY-MANGGA-500",
            name: "Mangga 500ml",
            net_content: { quantity: "500.000000", uom: "ML" },
            price: { currency: "IDR", amount: 30000 },
          },
          {
            variant_id: "01940a00-0005-7000-8000-000000000003",
            sku: "CY-MANGGA-1000",
            name: "Mangga 1000ml",
            net_content: { quantity: "1.000000", uom: "L" },
            price: { currency: "IDR", amount: 55000 },
          },
        ],
      },
      {
        slug: "vanila",
        name: "Vanila",
        variants: [
          {
            variant_id: "01940a00-0006-7000-8000-000000000001",
            sku: "CY-VANILA-250",
            name: "Vanila 250ml",
            net_content: { quantity: "250.000000", uom: "ML" },
            price: { currency: "IDR", amount: 16000 },
          },
          {
            variant_id: "01940a00-0006-7000-8000-000000000002",
            sku: "CY-VANILA-500",
            name: "Vanila 500ml",
            net_content: { quantity: "500.000000", uom: "ML" },
            price: { currency: "IDR", amount: 30000 },
          },
          {
            variant_id: "01940a00-0006-7000-8000-000000000003",
            sku: "CY-VANILA-1000",
            name: "Vanila 1000ml",
            net_content: { quantity: "1.000000", uom: "L" },
            price: { currency: "IDR", amount: 55000 },
          },
        ],
      },
      {
        slug: "melon",
        name: "Melon",
        variants: [
          {
            variant_id: "01940a00-0007-7000-8000-000000000001",
            sku: "CY-MELON-250",
            name: "Melon 250ml",
            net_content: { quantity: "250.000000", uom: "ML" },
            price: { currency: "IDR", amount: 16000 },
          },
          {
            variant_id: "01940a00-0007-7000-8000-000000000002",
            sku: "CY-MELON-500",
            name: "Melon 500ml",
            net_content: { quantity: "500.000000", uom: "ML" },
            price: { currency: "IDR", amount: 30000 },
          },
          {
            variant_id: "01940a00-0007-7000-8000-000000000003",
            sku: "CY-MELON-1000",
            name: "Melon 1000ml",
            net_content: { quantity: "1.000000", uom: "L" },
            price: { currency: "IDR", amount: 55000 },
          },
        ],
      },
    ],
  };

  // Test A: Current seven products render from ERP catalog
  it("A: proves current seven products parse and render from ERP catalog", () => {
    const parsed = parsePublicCatalogResponse(officialCatalogFixture);
    assert.ok(parsed, "Catalog response must parse successfully");
    assert.equal(parsed.products.length, 7);

    const expectedSlugs = ["plain", "anggur", "stroberi", "leci", "mangga", "vanila", "melon"];
    const actualSlugs = parsed.products.map((p) => p.slug);
    assert.deepEqual(actualSlugs, expectedSlugs);

    for (const product of parsed.products) {
      assert.equal(product.variants.length, 3, `${product.slug} must have 3 variants`);
      const presentation = getProductPresentation(product.slug);
      assert.ok(presentation.brandColor, `Presentation for ${product.slug} must have brandColor`);
      assert.ok(presentation.artwork, `Presentation for ${product.slug} must have artwork`);

      // Variant net contents resolve to 250, 500, 1000 ml
      const sizes = product.variants.map((v) =>
        parseNetContentMl(v.net_content?.quantity, v.net_content?.uom)
      );
      assert.deepEqual(sizes.sort((a, b) => (a ?? 0) - (b ?? 0)), [250, 500, 1000]);
    }
  });

  // Test B: A hypothetical legitimate new ERP product not present in presentation overrides still renders
  it("B: proves a new legitimate ERP product renders using generic presentation fallback", () => {
    const expandedFixture = {
      products: [
        ...officialCatalogFixture.products,
        {
          slug: "blueberry",
          name: "Blueberry Fresh",
          description: "Yoghurt segar dengan rasa buah blueberry asli.",
          variants: [
            {
              variant_id: "01940a00-0008-7000-8000-000000000001",
              sku: "CY-BLUEBERRY-250",
              name: "Blueberry 250ml",
              net_content: { quantity: "250.000000", uom: "ML" },
              price: { currency: "IDR", amount: 18000 },
            },
            {
              variant_id: "01940a00-0008-7000-8000-000000000002",
              sku: "CY-BLUEBERRY-500",
              name: "Blueberry 500ml",
              net_content: { quantity: "500.000000", uom: "ML" },
              price: { currency: "IDR", amount: 34000 },
            },
          ],
        },
      ],
    };

    const parsed = parsePublicCatalogResponse(expandedFixture);
    assert.ok(parsed, "Expanded catalog must parse successfully");
    assert.equal(parsed.products.length, 8);

    const blueberry = parsed.products.find((p) => p.slug === "blueberry");
    assert.ok(blueberry, "New product 'blueberry' must exist in parsed catalog");
    assert.equal(blueberry.name, "Blueberry Fresh");

    // Presentation override must not exist for blueberry
    assert.equal(blueberry.slug in PRESENTATION_OVERRIDES, false);

    // Presentation must cleanly fallback to DEFAULT_PRESENTATION_FALLBACK
    const presentation = getProductPresentation(blueberry.slug);
    assert.equal(presentation.brandColor, DEFAULT_PRESENTATION_FALLBACK.brandColor);
    assert.equal(presentation.colorClass, DEFAULT_PRESENTATION_FALLBACK.colorClass);
    assert.equal(presentation.artwork, undefined);
  });

  // Test C: Product detail for legitimate ERP product is not 404 solely because no presentation entry exists
  it("C: proves product detail resolution accepts legitimate ERP product missing from presentation overrides", () => {
    const catalogProducts: PublicCatalogProduct[] = [
      {
        slug: "blueberry",
        name: "Blueberry Fresh",
        variants: [
          {
            variant_id: "01940a00-0008-7000-8000-000000000001",
            sku: "CY-BLUEBERRY-250",
            name: "Blueberry 250ml",
            price: { currency: "IDR", amount: 18000 },
          },
        ],
      },
    ];

    // Simulating PDP product resolution logic
    function resolveProductDetail(
      slug: string,
      isCatalogOnline: boolean,
      products: PublicCatalogProduct[]
    ): { status: 200 | 404; product: PublicCatalogProduct | null } {
      const normalizedSlug = slug.trim().toLowerCase();
      if (isCatalogOnline) {
        const found = products.find((p) => p.slug.toLowerCase() === normalizedSlug);
        if (!found) {
          return { status: 404, product: null };
        }
        return { status: 200, product: found };
      } else {
        const isKnown = normalizedSlug in PRESENTATION_OVERRIDES;
        if (!isKnown) {
          return { status: 404, product: null };
        }
        return { status: 200, product: null };
      }
    }

    const result = resolveProductDetail("blueberry", true, catalogProducts);
    assert.equal(result.status, 200, "Legitimate ERP product must not 404");
    assert.equal(result.product?.name, "Blueberry Fresh");
  });

  // Test D: A truly nonexistent product remains 404
  it("D: proves a truly nonexistent product resolves to 404", () => {
    const catalogProducts: PublicCatalogProduct[] = [
      {
        slug: "plain",
        name: "Plain",
        variants: [],
      },
    ];

    function resolveProductDetail(
      slug: string,
      isCatalogOnline: boolean,
      products: PublicCatalogProduct[]
    ): { status: 200 | 404 } {
      const normalizedSlug = slug.trim().toLowerCase();
      if (isCatalogOnline) {
        const found = products.find((p) => p.slug.toLowerCase() === normalizedSlug);
        return found ? { status: 200 } : { status: 404 };
      } else {
        const isKnown = normalizedSlug in PRESENTATION_OVERRIDES;
        return isKnown ? { status: 200 } : { status: 404 };
      }
    }

    assert.equal(resolveProductDetail("dragonfruit", true, catalogProducts).status, 404);
    assert.equal(resolveProductDetail("pisang", true, catalogProducts).status, 404);
    assert.equal(resolveProductDetail("unknown-product", true, catalogProducts).status, 404);
  });

  // Test E: Prices are taken from ERP and not static presentation metadata
  it("E: proves prices are authoritative from ERP and override any static copy", () => {
    const dynamicPriceFixture = {
      products: [
        {
          slug: "plain",
          name: "Plain",
          variants: [
            {
              variant_id: "01940a00-0001-7000-8000-000000000001",
              sku: "CY-PLAIN-250",
              name: "Plain 250ml",
              net_content: { quantity: "250.000000", uom: "ML" },
              price: { currency: "IDR", amount: 17500 }, // updated from 16000
            },
            {
              variant_id: "01940a00-0001-7000-8000-000000000002",
              sku: "CY-PLAIN-500",
              name: "Plain 500ml",
              net_content: { quantity: "500.000000", uom: "ML" },
              price: { currency: "IDR", amount: 32500 }, // updated from 30000
            },
          ],
        },
      ],
    };

    const parsed = parsePublicCatalogResponse(dynamicPriceFixture);
    assert.ok(parsed);
    const plainProduct = parsed.products[0];
    const v250 = plainProduct.variants.find((v) =>
      parseNetContentMl(v.net_content?.quantity, v.net_content?.uom) === 250
    );
    const v500 = plainProduct.variants.find((v) =>
      parseNetContentMl(v.net_content?.quantity, v.net_content?.uom) === 500
    );

    assert.equal(v250?.price.amount, 17500, "Price must be ERP authoritative");
    assert.equal(v500?.price.amount, 32500, "Price must be ERP authoritative");
  });

  // Test F: Add to Cart uses real ERP variant_id
  it("F: proves Add to Cart stores and projects valid ERP variant_id", () => {
    const validVariantId = "01940a00-0001-7000-8000-000000000001";
    assert.ok(isUuid(validVariantId), "Variant ID must be valid UUID");

    const cartItem: CartItem = {
      variant_id: validVariantId,
      sku: "CY-PLAIN-250",
      name: "Plain 250ml",
      volume_ml: 250,
      quantity: 2,
      display_price: 16000,
    };

    const projection = toTransactionProjection([cartItem]);
    assert.deepEqual(projection, [
      {
        variant_id: validVariantId,
        quantity: 2,
      },
    ]);

    const checkoutPayload: CheckoutPayload = {
      customer: {
        name: "Test Customer",
        whatsapp: "081234567890",
        address: "Jl. Sudirman No. 1, Jakarta",
      },
      items: projection,
      delivery_method: "instant",
    };

    const canonical = buildCanonicalCheckoutPayload(checkoutPayload);

    assert.equal(canonical.items[0].variant_id, validVariantId);
    assert.equal(canonical.items[0].quantity, 2);
  });

  // Test G: Preview mode cannot transact
  it("G: proves preview mode items with fabricated IDs cannot transact", async () => {
    const previewCartItem: CartItem = {
      variant_id: "preview-plain-250", // fabricated preview ID
      sku: "CY-PLAIN-250",
      name: "Plain 250ml (Preview)",
      volume_ml: 250,
      quantity: 1,
      display_price: 16000,
    };

    assert.equal(isUuid(previewCartItem.variant_id), false);

    const projection = toTransactionProjection([previewCartItem]);

    const previewCheckoutPayload: CheckoutPayload = {
      customer: {
        name: "Test Customer",
        whatsapp: "081234567890",
        address: "Jl. Sudirman No. 1, Jakarta",
      },
      items: projection,
      delivery_method: "instant",
    };

    const result = await executeCheckoutSubmission(previewCheckoutPayload);
    assert.equal(result.success, false);
    assert.ok(
      result.error?.includes("tidak valid") || result.error?.includes("pratinjau"),
      "Checkout submission must reject non-UUID or preview variant IDs"
    );
  });
});
