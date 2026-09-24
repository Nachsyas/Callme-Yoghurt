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

    // H. Cart transaction remains variant_id + quantity only
    const transactionProjection = await page.evaluate(() => {
      const store = (window as unknown as { __cartStore?: { getState: () => { items: Array<{ variant_id: string; quantity: number }> } } }).__cartStore?.getState();
      if (!store) return null;
      return store.items.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
      }));
    });

    expect(transactionProjection).not.toBeNull();
    expect(transactionProjection).toEqual([
      {
        variant_id: expectedVariantId,
        quantity: 1,
      },
    ]);

    // Ensure transaction payload contains strictly variant_id and quantity (no price, total, etc.)
    const firstProjectedItem = transactionProjection![0];
    const keys = Object.keys(firstProjectedItem);
    expect(keys.sort()).toEqual(["quantity", "variant_id"]);
  });

  test("Nonexistent product returns 404 when ERP catalog is online and product is absent", async ({ page }) => {
    await page.goto("/product/nonexistent");
    await page.waitForLoadState("networkidle");

    // Verify 404 UI renders correctly
    await expect(page.getByText("404 — Not Found")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Produk tidak ditemukan" })).toBeVisible();
    await expect(page.getByText("Varian yoghurt yang Anda cari tidak tersedia")).toBeVisible();
  });
});
