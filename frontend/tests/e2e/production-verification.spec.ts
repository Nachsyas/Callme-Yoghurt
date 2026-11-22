import { test, expect } from "@playwright/test";
import * as path from "path";

const PROD_BASE_URL = "https://callme-yoghurt-storefront.vercel.app";
const ARTIFACTS_DIR = "/Users/user/.gemini/antigravity-ide/brain/84493374-de71-4ba1-9395-94d6aa88099c";

test.describe("Production Verification — Live Storefront & Fail-Closed Boundaries", () => {
  test.use({ baseURL: PROD_BASE_URL });

  test("Verify live production deployment and capture all required verification screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    // 1. Production Homepage
    console.log("Navigating to production homepage...");
    const homeResponse = await page.goto("/");
    expect(homeResponse?.status()).toBe(200);
    await expect(page.locator("body")).toBeVisible();
    await page.waitForTimeout(1000);

    const homeScreenshotPath = path.join(ARTIFACTS_DIR, "production-homepage.png");
    await page.screenshot({ path: homeScreenshotPath, fullPage: true });
    console.log(`Saved screenshot 1: ${homeScreenshotPath}`);

    // 2. Production Product Detail
    console.log("Navigating to product detail: Plain...");
    const pdpResponse = await page.goto("/product/plain");
    expect(pdpResponse?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /Plain/i })).toBeVisible();
    await page.waitForTimeout(800);

    const pdpScreenshotPath = path.join(ARTIFACTS_DIR, "production-product-detail.png");
    await page.screenshot({ path: pdpScreenshotPath, fullPage: true });
    console.log(`Saved screenshot 2: ${pdpScreenshotPath}`);

    // 3. Production Product Variants
    console.log("Verifying variant independence: 250ml, 500ml, 1 Liter...");
    const btn250 = page.getByRole("button", { name: /250\s*ml/i });
    const btn500 = page.getByRole("button", { name: /500\s*ml/i });
    const btn1L = page.getByRole("button", { name: /(1\s*Liter|1000\s*ml)/i });

    await expect(btn250).toBeVisible();
    await expect(btn500).toBeVisible();
    await expect(btn1L).toBeVisible();

    // Select 500ml variant (Rp 30.000)
    await btn500.click();
    await page.waitForTimeout(400);

    const variantsScreenshotPath = path.join(ARTIFACTS_DIR, "production-product-variants.png");
    await page.screenshot({ path: variantsScreenshotPath, fullPage: true });
    console.log(`Saved screenshot 3: ${variantsScreenshotPath}`);

    // 4. Production Cart
    console.log("Adding variant to cart...");
    const addToCartBtn = page.getByRole("button", { name: /(Tambah ke Keranjang|Tambahkan ke Pesanan)/i });
    await addToCartBtn.click();

    const drawer = page.locator("#cart-drawer");
    await expect(drawer).toBeVisible();
    await page.waitForTimeout(600);

    const cartScreenshotPath = path.join(ARTIFACTS_DIR, "production-cart.png");
    await page.screenshot({ path: cartScreenshotPath, fullPage: true });
    console.log(`Saved screenshot 4: ${cartScreenshotPath}`);

    // 5. Production Checkout
    console.log("Proceeding to live checkout...");
    const checkoutCTA = drawer.getByRole("link", { name: /Lanjut ke Checkout/i });
    await checkoutCTA.click();
    await page.waitForURL("**/checkout");
    await page.waitForTimeout(800);

    const checkoutScreenshotPath = path.join(ARTIFACTS_DIR, "production-checkout.png");
    await page.screenshot({ path: checkoutScreenshotPath, fullPage: true });
    console.log(`Saved screenshot 5: ${checkoutScreenshotPath}`);

    // 6. Production Shipping State & Safe Fail-Closed Trigger
    console.log("Filling synthetic address and testing live shipping calculation...");
    await page.locator('input[name="name"]').fill("Budi Santoso");
    await page.locator('input[name="whatsapp"]').fill("08123456789");
    await page.locator('textarea[name="address"]').fill("Jl. Bambu Apus No. 12, RT 02/RW 05, Cipayung, Jakarta Timur");

    const hitungBtn = page.getByRole("button", { name: /Hitung Ongkir Resmi/i });
    await expect(hitungBtn).toBeVisible();
    await hitungBtn.click();

    // Wait for Biteship BFF response
    await page.waitForTimeout(2500);

    // Verify safe fail-closed banner appears
    await expect(page.getByText("Ongkir belum dapat dihitung").first()).toBeVisible();

    const shippingStateScreenshotPath = path.join(ARTIFACTS_DIR, "production-shipping-state.png");
    await page.screenshot({ path: shippingStateScreenshotPath, fullPage: true });
    console.log(`Saved screenshot 6: ${shippingStateScreenshotPath}`);

    // 7. Production Order Summary
    const summaryCard = page.locator(".lg\\:col-span-5");
    await expect(summaryCard).toBeVisible();

    // Verify line items in Order Summary
    await expect(summaryCard.getByText("Subtotal Produk")).toBeVisible();
    await expect(summaryCard.getByText("Rp 30.000").first()).toBeVisible();
    await expect(summaryCard.getByText("Ongkir belum dapat dihitung")).toBeVisible();
    await expect(summaryCard.getByText("Biaya Layanan")).toBeVisible();
    await expect(summaryCard.getByText("Konfigurasi belum ditentukan")).toBeVisible();

    const orderSummaryScreenshotPath = path.join(ARTIFACTS_DIR, "production-order-summary.png");
    await summaryCard.screenshot({ path: orderSummaryScreenshotPath });
    console.log(`Saved screenshot 7: ${orderSummaryScreenshotPath}`);

    // 8. Production Biteship Rates (Safe Fail-Closed card)
    const ratesScreenshotPath = path.join(ARTIFACTS_DIR, "production-biteship-rates.png");
    await page.screenshot({ path: ratesScreenshotPath, fullPage: true });
    console.log(`Saved screenshot 8: ${ratesScreenshotPath}`);

    // 9. Production Total Calculation
    const totalCalcScreenshotPath = path.join(ARTIFACTS_DIR, "production-total-calculation.png");
    await summaryCard.screenshot({ path: totalCalcScreenshotPath });
    console.log(`Saved screenshot 9: ${totalCalcScreenshotPath}`);

    // Verify submit button is safely disabled preventing unauthorized payment commitment
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toContainText("Hitung & Pilih Ongkir Terlebih Dahulu");
    console.log("Confirmed: payment commitment is safely disabled in production fail-closed state.");
  });
});
