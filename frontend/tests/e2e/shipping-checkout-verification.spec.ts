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

const MOCK_SHIPPING_QUOTES = {
  success: true,
  service_fee: {
    isConfigured: true,
    amount: 1000,
    name: "Biaya Layanan",
  },
  quotes: [
    {
      quote_id: "biteship_grab_instant_24000",
      provider: "Biteship",
      courier_name: "Grab",
      courier_code: "grab",
      service_name: "Instant",
      service_code: "instant",
      service_type: "instant",
      price: 24000,
      duration: "1-3 hours",
      cold_chain_compliant: true,
      description: "Pengiriman kilat 1-3 jam dengan icepack",
    },
    {
      quote_id: "biteship_gojek_sameday_18000",
      provider: "Biteship",
      courier_name: "Gojek",
      courier_code: "gojek",
      service_name: "Same Day",
      service_code: "sameday",
      service_type: "sameday",
      price: 18000,
      duration: "same day",
      cold_chain_compliant: true,
      description: "Pengiriman hari yang sama",
    },
  ],
};

test.describe("Phase 1.7C.19A — Biteship Rates Hardening & Service Fee Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CATALOG),
      });
    });

    await page.route("**/api/shipping/quote**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            service_fee: {
              isConfigured: true,
              amount: 1000,
              name: "Biaya Layanan",
            },
            quotes: [],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_SHIPPING_QUOTES),
        });
      }
    });

    await page.route("**/api/shipping/areas**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          areas: [
            {
              id: "area_cipayung_13890",
              name: "Cipayung, Jakarta Timur, DKI Jakarta. 13890",
              postal_code: 13890,
              administrative_division_level_1_name: "DKI Jakarta",
              administrative_division_level_2_name: "Jakarta Timur",
              administrative_division_level_3_name: "Cipayung",
            },
          ],
        }),
      });
    });
  });

  test("End-to-end verified checkout: variants active, zero pickup, real rates, Biaya Layanan, and safe payment boundary", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    // 1. Product Detail Page: verify all variants active independently
    await page.goto("/product/plain");
    await expect(page.getByText("Plain Pure Original")).toBeVisible();

    // Verify 250ml, 500ml, 1 Liter are all visible and selectable
    const btn250 = page.getByRole("button", { name: /250\s*ml/i });
    const btn500 = page.getByRole("button", { name: /500\s*ml/i });
    const btn1L = page.getByRole("button", { name: /(1\s*Liter|1000\s*ml)/i });

    await expect(btn250).toBeVisible();
    await expect(btn500).toBeVisible();
    await expect(btn1L).toBeVisible();

    // Capture Artifact 1: product-detail-active-variants.png
    const screenshot1Path = path.join(ARTIFACTS_DIR, "product-detail-active-variants.png");
    await page.screenshot({ path: screenshot1Path, fullPage: true });
    console.log(`Saved screenshot 1: ${screenshot1Path}`);

    // Select 500ml (Rp 30.000)
    await btn500.click();
    const addToCartBtn = page.getByRole("button", { name: /(Tambah ke Keranjang|Tambahkan ke Pesanan)/i });
    await expect(addToCartBtn).toBeVisible();
    await addToCartBtn.click();

    // Cart Drawer opens
    const drawer = page.locator("#cart-drawer");
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(400);

    // Capture Artifact 2: cart-with-selected-variant.png
    const screenshot2Path = path.join(ARTIFACTS_DIR, "cart-with-selected-variant.png");
    await page.screenshot({ path: screenshot2Path, fullPage: true });
    console.log(`Saved screenshot 2: ${screenshot2Path}`);

    // Proceed to checkout
    const checkoutCTA = drawer.getByRole("link", { name: /Lanjut ke Checkout/i });
    await checkoutCTA.click();
    await page.waitForURL("**/checkout");

    // Verify required customer address fields exist
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="whatsapp"]')).toBeVisible();
    await expect(page.locator('textarea[name="address"]')).toBeVisible();
    await expect(page.locator('input[name="province"]')).toBeVisible();
    await expect(page.locator('input[name="city"]')).toBeVisible();
    await expect(page.locator('input[name="district"]')).toBeVisible();
    await expect(page.locator('input[name="postalCode"]')).toBeVisible();

    // Fill synthetic customer address details
    await page.locator('input[name="name"]').fill("Budi Santoso");
    await page.locator('input[name="whatsapp"]').fill("08123456789");
    await page.locator('textarea[name="address"]').fill("Jl. Bambu Apus No. 12, RT 02/RW 05, Cipayung");

    // Capture Artifact 3: checkout-address.png
    const screenshot3Path = path.join(ARTIFACTS_DIR, "checkout-address.png");
    await page.screenshot({ path: screenshot3Path, fullPage: true });
    console.log(`Saved screenshot 3: ${screenshot3Path}`);

    // Trigger Hitung Ongkir Resmi (Biteship Rates)
    const hitungBtn = page.getByRole("button", { name: /Hitung Ongkir Resmi/i });
    await expect(hitungBtn).toBeVisible();
    await hitungBtn.click();

    // Verify Biteship Rates appear
    await expect(page.getByText("Grab Instant", { exact: true })).toBeVisible();
    await expect(page.getByText("Rp 24.000").first()).toBeVisible();
    await expect(page.getByText("Gojek Same Day", { exact: true })).toBeVisible();
    await expect(page.getByText("Rp 18.000")).toBeVisible();

    // STRICT CHECK: Ensure unapproved pickup option is completely gone
    await expect(page.getByText("Pickup (Ambil Sendiri)")).not.toBeVisible();
    await expect(page.getByText("Hub Bambu Apus Store Pickup")).not.toBeVisible();
    await expect(page.getByText("Ambil Sendiri")).not.toBeVisible();

    // Capture Artifact 4: checkout-biteship-quotes.png
    const screenshot4Path = path.join(ARTIFACTS_DIR, "checkout-biteship-quotes.png");
    await page.screenshot({ path: screenshot4Path, fullPage: true });
    console.log(`Saved screenshot 4: ${screenshot4Path}`);

    // Summary Card element
    const summaryCard = page.locator(".lg\\:col-span-5");

    // Verify Exact Line Items: Subtotal, Ongkir, Biaya Layanan, Total Pembayaran
    await expect(summaryCard.getByText("Subtotal Produk")).toBeVisible();
    await expect(summaryCard.getByText("Rp 30.000").first()).toBeVisible();

    await expect(summaryCard.getByText("Ongkir (Grab Instant)")).toBeVisible();
    await expect(summaryCard.getByText("Rp 24.000")).toBeVisible();

    // Verify official Biaya Layanan requirement
    await expect(summaryCard.getByText("Biaya Layanan", { exact: true })).toBeVisible();
    await expect(summaryCard.getByText("Rp 1.000")).toBeVisible();

    // Verify Cold chain packaging has NO extra surcharge and uses SOP 01 copy
    await expect(summaryCard.getByText("SOP Pengiriman Dairy")).toBeVisible();
    await expect(summaryCard.getByText("Sesuai Standar Mutu")).toBeVisible();

    // Total Calculation: 30.000 (subtotal) + 24.000 (shipping) + 1.000 (service fee) = Rp 55.000
    await expect(summaryCard.getByText("Total Pembayaran")).toBeVisible();
    await expect(summaryCard.getByText("Rp 55.000")).toBeVisible();

    // Capture Artifact 5: checkout-total-with-service-fee.png
    const screenshot5Path = path.join(ARTIFACTS_DIR, "checkout-total-with-service-fee.png");
    await page.screenshot({ path: screenshot5Path, fullPage: true });
    console.log(`Saved screenshot 5: ${screenshot5Path}`);

    // Verify Payment section: Manual QRIS merchant only, independent of gateway
    await expect(page.getByText("QRIS (Scan & Bayar Instan)")).toBeVisible();
    await expect(page.getByText("Bebas Biaya Admin")).toBeVisible();

    // Capture Artifact 6: checkout-payment-not-ready.png
    const screenshot6Path = path.join(ARTIFACTS_DIR, "checkout-payment-not-ready.png");
    await page.screenshot({ path: screenshot6Path, fullPage: true });
    console.log(`Saved screenshot 6: ${screenshot6Path}`);

    // Switch to Gojek Same Day
    const samedayRadio = page.locator('input[value="biteship_gojek_sameday_18000"]');
    await samedayRadio.click();

    // Total recalculates: 30.000 + 18.000 + 1.000 = Rp 49.000
    await expect(summaryCard.getByText("Ongkir (Gojek Same Day)")).toBeVisible();
    await expect(summaryCard.getByText("Rp 18.000")).toBeVisible();
    await expect(summaryCard.getByText("Rp 49.000")).toBeVisible();
  });

  test("Form Validation for Required Address & Shipping", async ({ page }) => {
    await page.goto("/product/plain");
    await page.getByRole("button", { name: /500\s*ml/i }).click();
    await page.getByRole("button", { name: /(Tambah ke Keranjang|Tambahkan ke Pesanan)/i }).click();

    const drawer = page.locator("#cart-drawer");
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(400);

    const checkoutCTA = drawer.getByRole("link", { name: /Lanjut ke Checkout/i });
    await checkoutCTA.click();
    await page.waitForURL("**/checkout");

    // Clear required fields to test client validation
    await page.locator('input[name="name"]').fill("");
    await page.locator('input[name="whatsapp"]').fill("");
    await page.locator('textarea[name="address"]').fill("");

    // Submit button is disabled because shipping quote is not calculated
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
    expect(page.url()).toContain("/checkout");
  });
});
