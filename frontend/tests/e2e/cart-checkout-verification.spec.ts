import { test, expect } from "@playwright/test";
import * as path from "path";

const ARTIFACTS_DIR = "/Users/user/.gemini/antigravity-ide/brain/84493374-de71-4ba1-9395-94d6aa88099c";

const MOCK_CATALOG = {
  products: [
    {
      product_id: "018f6c38-8c50-711e-b8d4-53a8be77e001",
      name: "Plain Pure Original",
      slug: "plain",
      category: "stirred",
      variants: [
        {
          variant_id: "018f6c38-8c50-711e-b8d4-53a8be77e440",
          sku: "CY-PLO-250",
          name: "Plain Pure Original 250ml",
          net_content: { quantity: "250.000000", uom: "ML" },
          price: { amount: 16000, currency: "IDR" },
        },
        {
          variant_id: "018f6c38-8c50-711e-b8d4-53a8be77e441",
          sku: "CY-PLO-500",
          name: "Plain Pure Original 500ml",
          net_content: { quantity: "500.000000", uom: "ML" },
          price: { amount: 30000, currency: "IDR" },
        },
        {
          variant_id: "018f6c38-8c50-711e-b8d4-53a8be77e442",
          sku: "CY-PLO-1000",
          name: "Plain Pure Original 1000ml",
          net_content: { quantity: "1000.000000", uom: "ML" },
          price: { amount: 55000, currency: "IDR" },
        },
      ],
    },
  ],
};

test.describe("Phase 1.7C.12 — Customer Cart and Checkout Flow Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CATALOG),
      });
    });

    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });
  });

  test("Task 1, 2, 4, 5 — Product Detail -> Variant Selection -> Cart Drawer (Desktop 1280px)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Visit Plain product detail
    await page.goto("/product/plain");
    await expect(page.getByText("Plain Pure Original")).toBeVisible();

    // Verify initial 250ml variant price is Rp 16.000 (NOT Rp 15.000)
    await expect(page.getByText("Rp 16.000").first()).toBeVisible();
    await expect(page.getByText("Rp 15.000")).not.toBeVisible();

    // 2. Select 500ml variant
    const variant500Btn = page.getByRole("button", { name: /500\s*ml/i });
    await expect(variant500Btn).toBeVisible();
    await variant500Btn.click();

    // Price must update to Rp 30.000
    await expect(page.getByText("Rp 30.000").first()).toBeVisible();

    // 3. Click Tambah ke Keranjang
    const addToCartBtn = page.getByRole("button", { name: /Tambah ke Keranjang/i });
    await expect(addToCartBtn).toBeVisible();
    await addToCartBtn.click();

    // 4. Cart Drawer opens
    const drawer = page.locator("#cart-drawer");
    await expect(drawer).toBeVisible();

    // Verify Cart contents:
    // - Correct product name: Plain Pure Original 500ml
    // - Correct size: 500 ml
    // - Correct price & subtotal: Rp 30.000
    // - Correct quantity: 1
    // - Clear product image visible
    // - Remove item button visible
    // - Quantity controls (+ and -)
    // - Checkout CTA visible
    await expect(drawer.getByText("Plain Pure Original 500ml")).toBeVisible();
    await expect(drawer.getByText("500 ml")).toBeVisible();
    await expect(drawer.getByText("Rp 30.000").first()).toBeVisible();
    await expect(drawer.getByText("1", { exact: true })).toBeVisible();
    await expect(drawer.locator('img[alt*="Plain"]')).toBeVisible();
    await expect(drawer.getByRole("button", { name: /Hapus Plain Pure Original/i })).toBeVisible();
    await expect(drawer.getByRole("button", { name: /Tambah kuantitas/i })).toBeVisible();
    await expect(drawer.getByRole("button", { name: /Kurangi kuantitas/i })).toBeVisible();

    const checkoutCTA = drawer.getByRole("link", { name: /Lanjut ke Checkout/i });
    await expect(checkoutCTA).toBeVisible();

    // Capture screenshot: cart with item (wait for sliding drawer animation to settle)
    await page.waitForTimeout(500);
    const cartScreenshotPath = path.join(ARTIFACTS_DIR, "cart_with_item.png");
    await page.screenshot({ path: cartScreenshotPath, fullPage: false });
    console.log(`Saved cart screenshot to: ${cartScreenshotPath}`);

    // Verify no horizontal overflow on desktop
    const hasDesktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasDesktopOverflow).toBe(false);
  });

  test("Task 3 & 4 — Checkout Page Flow & Order Summary Verification", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Setup cart with 500ml Plain item
    await page.goto("/product/plain");
    await page.getByRole("button", { name: /500\s*ml/i }).click();
    await page.getByRole("button", { name: /Tambah ke Keranjang/i }).click();

    const drawer = page.locator("#cart-drawer");
    await expect(drawer).toBeVisible();
    const checkoutCTA = drawer.getByRole("link", { name: /Lanjut ke Checkout/i });
    await checkoutCTA.click();

    // Verify on /checkout page
    await page.waitForURL("**/checkout");
    await expect(page.getByRole("heading", { name: /Checkout Pesanan/i })).toBeVisible();

    // Verify Customer information fields: Name, Phone/WhatsApp, Address
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="whatsapp"]')).toBeVisible();
    await expect(page.locator('textarea[name="address"]')).toBeVisible();

    // Verify Order summary:
    // - Product name: Plain Pure Original 500ml
    // - Variant/Size: 500 ml
    // - Quantity: 1
    // - Price & Total: Rp 30.000
    // - Clear image
    const summary = page.locator(".lg\\:col-span-5");
    await expect(summary.getByText("Plain Pure Original 500ml")).toBeVisible();
    await expect(summary.getByText("500 ml")).toBeVisible();
    await expect(summary.getByText("Rp 30.000").first()).toBeVisible();
    await expect(summary.locator('img[alt*="Plain"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /(Selesaikan Pesanan|Hitung & Pilih Ongkir)/i })).toBeVisible();

    // Capture screenshot: checkout page
    const checkoutScreenshotPath = path.join(ARTIFACTS_DIR, "checkout_page.png");
    await page.screenshot({ path: checkoutScreenshotPath, fullPage: true });
    console.log(`Saved checkout screenshot to: ${checkoutScreenshotPath}`);
  });

  test("Task 5 — Mobile Responsive Check (390px)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/product/plain");
    await expect(page.getByText("Plain Pure Original")).toBeVisible();

    // Verify no horizontal overflow on mobile product detail
    let hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);

    // Select 500ml and add to cart
    await page.getByRole("button", { name: /500\s*ml/i }).click();
    await page.getByRole("button", { name: /Tambah ke Keranjang/i }).click();

    // Verify Cart Drawer opens and works on mobile
    const drawer = page.locator("#cart-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Plain Pure Original 500ml")).toBeVisible();
    await expect(drawer.getByText("500 ml")).toBeVisible();
    await expect(drawer.getByText("Rp 30.000").first()).toBeVisible();

    const checkoutCTA = drawer.getByRole("link", { name: /Lanjut ke Checkout/i });
    await expect(checkoutCTA).toBeVisible();

    // Navigate to checkout on mobile
    await checkoutCTA.click();
    await page.waitForURL("**/checkout");
    await expect(page.getByRole("heading", { name: /Checkout Pesanan/i })).toBeVisible();

    // Verify no horizontal overflow on mobile checkout page
    hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);

    // Verify checkout CTA button is fully visible and clickable
    const submitBtn = page.getByRole("button", { name: /(Selesaikan Pesanan|Hitung & Pilih Ongkir)/i });
    await expect(submitBtn).toBeVisible();
  });

  test("Task 4 — Variant Price Integrity (250ml: 16k, 500ml: 30k, 1L: 55k; Never 15k)", async ({ page }) => {
    await page.goto("/product/plain");

    // 250ml
    const btn250 = page.getByRole("button", { name: /250\s*ml/i });
    await btn250.click();
    await expect(page.getByText("Rp 16.000").first()).toBeVisible();
    await expect(page.getByText("Rp 15.000")).not.toBeVisible();

    // 500ml
    const btn500 = page.getByRole("button", { name: /500\s*ml/i });
    await btn500.click();
    await expect(page.getByText("Rp 30.000").first()).toBeVisible();

    // 1 Liter
    const btn1000 = page.getByRole("button", { name: /1\s*Liter/i });
    await btn1000.click();
    await expect(page.getByText("Rp 55.000").first()).toBeVisible();
  });

  test("Task 3 — Prevent Checkout with Empty Cart", async ({ page }) => {
    await page.goto("/checkout");
    // Empty state must be rendered
    await expect(page.getByText("Keranjangmu masih kosong")).toBeVisible();
    await expect(page.getByRole("link", { name: /Kembali ke Katalog/i })).toBeVisible();
    await expect(page.locator('form#checkout-form')).not.toBeVisible();
  });
});
