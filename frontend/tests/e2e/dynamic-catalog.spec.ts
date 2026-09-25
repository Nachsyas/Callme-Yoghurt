import { test, expect } from "@playwright/test";

const MOCK_BLUEBERRY_CATALOG = {
  products: [
    {
      slug: "blueberry",
      name: "Blueberry",
      description: "Yoghurt rasa Blueberry.",
      variants: [
        {
          variant_id: "01940a00-bbbb-7000-8000-000000000001",
          sku: "CY-BLUEBERRY-250",
          name: "Blueberry 250ml",
          net_content: { quantity: "250.000000", uom: "ML" },
          price: { currency: "IDR", amount: 18000 },
        },
        {
          variant_id: "01940a00-bbbb-7000-8000-000000000002",
          sku: "CY-BLUEBERRY-500",
          name: "Blueberry 500ml",
          net_content: { quantity: "500.000000", uom: "ML" },
          price: { currency: "IDR", amount: 32000 },
        },
      ],
    },
    {
      slug: "plain",
      name: "Plain",
      description: "Yoghurt rasa Plain.",
      variants: [
        {
          variant_id: "01940a00-0001-7000-8000-000000000001",
          sku: "CY-PLAIN-250",
          name: "Plain 250ml",
          net_content: { quantity: "250.000000", uom: "ML" },
          price: { currency: "IDR", amount: 16000 },
        },
      ],
    },
  ],
};

test.describe("Phase 1.7C.4 — Dynamic Product E2E Gate", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept and mock public catalog response at BFF boundary
    await page.route("**/api/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BLUEBERRY_CATALOG),
      });
    });
  });

  test("A-H: Proves dynamic ERP product renders, resolves variants, and adds to cart with pure transaction projection", async ({ page }) => {
    // Intercept checkout submission and capture the actual browser request payload
    let capturedCheckoutPayload: any = null;
    await page.route("**/api/checkout", async (route) => {
      const req = route.request();
      if (req.method() === "POST") {
        try {
          capturedCheckoutPayload = JSON.parse(req.postData() || "{}");
        } catch {
          capturedCheckoutPayload = req.postData();
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              order_id: "01940a00-cccc-7000-8000-000000000001",
              order_number: "CY-20260925-TEST",
              status: "CONFIRMED",
              total_amount: 32000,
              request_id: "req-dyn-test-1",
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // A. Homepage receives the mocked ERP catalog
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // B. Blueberry appears in the carousel despite having no PRESENTATION_OVERRIDES entry
    const carousel = page.locator("#catalog-carousel");
    await expect(carousel).toBeVisible();

    const blueberryCard = carousel.locator("article").filter({ hasText: "Blueberry" });
    await expect(blueberryCard).toBeVisible();

    // C. Generic fallback visual renders safely (initials 'BL', size badge, price)
    await expect(blueberryCard.getByText("BL", { exact: true })).toBeVisible();
    await expect(blueberryCard.getByText("Rp 18.000")).toBeVisible();

    // D. Clicking Detail navigates to /product/blueberry
    const detailLink = blueberryCard.getByRole("link", { name: "Detail" });
    await detailLink.click();
    await expect(page).toHaveURL(/.*\/product\/blueberry/);

    // E. Product detail renders the authoritative ERP name
    const heading = page.locator("h1");
    await expect(heading).toHaveText("Blueberry");
    await expect(page.getByText("Yoghurt rasa Blueberry.")).toBeVisible();

    // Generic fallback visual on detail page (initials 'BL')
    await expect(page.getByText("BL", { exact: true }).first()).toBeVisible();

    // F. 250ml / 500ml variants resolve correctly when supplied
    // Default 250ml price: Rp 18.000
    await expect(page.getByText("Rp 18.000").first()).toBeVisible();

    // Switch to 500ml variant: Rp 32.000
    const btn500 = page.getByRole("button", { name: /500 ml/i }).first();
    await expect(btn500).toBeVisible();
    await btn500.click();
    await expect(page.getByText("Rp 32.000").first()).toBeVisible();

    // G. Add to Cart uses the real mocked ERP variant UUID
    const addBtn = page.getByRole("button", { name: /Tambahkan ke Pesanan/i });
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    // Drawer opens automatically on Add to Cart
    const drawer = page.getByRole("dialog", { name: "Keranjang Belanja" });
    await expect(drawer).toBeVisible();

    // Verifies the item with mocked 500ml variant UUID exists in the cart UI
    const expectedVariantId = "01940a00-bbbb-7000-8000-000000000002";
    const cartItem = drawer.locator(`[data-variant-id="${expectedVariantId}"]`);
    await expect(cartItem).toBeVisible();
    await expect(cartItem.getByText("Blueberry 500ml")).toBeVisible();

    // H. Navigate to checkout via UI, fill form, select delivery, and submit
    const checkoutLink = drawer.getByRole("link", { name: /Lanjut ke Checkout/i });
    await expect(checkoutLink).toBeVisible();
    await checkoutLink.click();

    // Verify checkout page is reached
    await expect(page).toHaveURL(/.*\/checkout/);
    await expect(page.getByRole("heading", { name: /Checkout Pesanan/i })).toBeVisible();

    // Fill required customer fields
    await page.locator('input[name="name"]').fill("Budi Santoso");
    await page.locator('input[name="whatsapp"]').fill("081234567890");
    await page.locator('textarea[name="address"]').fill("Jl. Raya Bambu Apus No. 10, Cipayung, Jakarta Timur");

    // Select delivery method (cold chain instant)
    const deliveryRadio = page.locator('input[name="delivery"][value="instant"]');
    await deliveryRadio.check();
    await expect(deliveryRadio).toBeChecked();

    // Set up response listener for checkout submission
    const checkoutResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/checkout") && res.request().method() === "POST"
    );

    // Submit checkout form via the real button
    const submitBtn = page.locator('button[type="submit"][form="checkout-form"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Wait for the checkout request/response cycle to complete
    await checkoutResponsePromise;

    // I. Assert actual captured browser request body
    expect(capturedCheckoutPayload).not.toBeNull();
    expect(capturedCheckoutPayload.items).toBeDefined();
    expect(Array.isArray(capturedCheckoutPayload.items)).toBe(true);
    expect(capturedCheckoutPayload.items.length).toBeGreaterThanOrEqual(1);

    // Assert each transaction item has EXACTLY variant_id and quantity
    for (const item of capturedCheckoutPayload.items) {
      const keys = Object.keys(item).sort();
      expect(keys).toEqual(["quantity", "variant_id"]);
    }

    // Assert mocked Blueberry UUID is the real selected UUID
    expect(capturedCheckoutPayload.items[0].variant_id).toBe(expectedVariantId);
    expect(capturedCheckoutPayload.items[0].quantity).toBe(1);

    // Assert transaction body contains NO forbidden keys
    const forbiddenKeys = [
      "display_price",
      "price",
      "subtotal",
      "total",
      "sku",
      "name",
      "volume_ml",
    ];

    for (const key of forbiddenKeys) {
      expect(capturedCheckoutPayload).not.toHaveProperty(key);
      for (const item of capturedCheckoutPayload.items) {
        expect(item).not.toHaveProperty(key);
      }
    }
  });

  test("Nonexistent product returns 404 when ERP catalog is online and product is absent", async ({ page }) => {
    await page.goto("/product/nonexistent");
    await page.waitForLoadState("networkidle");

    // Verify 404 UI renders correctly
    await expect(page.getByText("404 — Not Found")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Produk tidak ditemukan" })).toBeVisible();
    await expect(page.getByText("Varian yoghurt yang Anda cari tidak tersedia")).toBeVisible();
  });

  test("AA: Valid active variant without public stock field renders without false stock claims", async ({ page }) => {
    // Navigate to product detail page with active catalog (no public stock field)
    await page.goto("/product/blueberry");
    await page.waitForLoadState("networkidle");

    // 1. Product and description render
    await expect(page.locator("h1")).toHaveText("Blueberry");
    await expect(page.getByText("Yoghurt rasa Blueberry.")).toBeVisible();

    // 2. Price renders accurately
    await expect(page.getByText("Rp 18.000").first()).toBeVisible();

    // 3. Size selectors render and work
    const btn250 = page.getByRole("button", { name: /250 ml/i }).first();
    const btn500 = page.getByRole("button", { name: /500 ml/i }).first();
    await expect(btn250).toBeVisible();
    await expect(btn500).toBeVisible();

    // Size selector switches price
    await btn500.click();
    await expect(page.getByText("Rp 32.000").first()).toBeVisible();

    // 4. UI does NOT claim "Stok Siap Kirim"
    await expect(page.getByText(/Stok Siap Kirim/i)).toHaveCount(0);

    // 5. UI does NOT infer unconditional "Tersedia" from variant existence
    // It should display neutral "Varian aktif" instead
    await expect(page.getByText("Varian aktif").first()).toBeVisible();
    await expect(page.getByText(/^Tersedia$/i)).toHaveCount(0);

    // 6. Cold chain logistics indicator renders neutral logistics distribution copy
    await expect(page.getByText(/Distribusi Rantai Dingin \(0–5°C\) — Jakarta Hub/i)).toBeVisible();
  });
});

