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
          sku: "CY-PLO-500",
          name: "Plain Pure Original 500ml",
          net_content: { quantity: "500.000000", uom: "ML" },
          price: { amount: 30000, currency: "IDR" },
        },
      ],
    },
  ],
};

const MOCK_ORDER_ID = "018f6c38-8c50-711e-b8d4-53a8be77e440";
const MOCK_ORDER_NUMBER = "CY-2026-0001";

test.describe("Phase 1.7C.14 — Payment Infrastructure Foundation E2E Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CATALOG),
      });
    });

    await page.route("**/api/checkout", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
        body: JSON.stringify({
          success: true,
          request_id: "e2e-pay-1",
          data: {
            order_id: MOCK_ORDER_ID,
            order_number: MOCK_ORDER_NUMBER,
            status: "CONFIRMED",
            total_amount: 55000, // 30.000 (subtotal) + 20.000 (instant shipping) + 5.000 (cold chain)
            request_id: "e2e-pay-1",
          },
        }),
      });
    });
  });

  test("Verify Customer Checkout -> Shipping Total -> QRIS Pending Payment Flow", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    // Step 1: Product -> Cart -> Checkout
    await page.goto("/product/plain");
    await expect(page.getByText("Plain Pure Original")).toBeVisible();

    await page.getByRole("button", { name: /500\s*ml/i }).click();
    await page.getByRole("button", { name: /Tambah ke Keranjang/i }).click();

    const drawer = page.locator("#cart-drawer");
    await expect(drawer).toBeVisible();

    const checkoutCTA = drawer.getByRole("link", { name: /Lanjut ke Checkout/i });
    await checkoutCTA.click();
    await page.waitForURL("**/checkout");

    // Task 3: Verify Payment Method Card on checkout
    await expect(page.getByText("Metode Pembayaran")).toBeVisible();
    await expect(page.getByText("QRIS (Scan & Bayar Instan)")).toBeVisible();
    await expect(page.getByText("Bebas Biaya Admin")).toBeVisible();

    // Verify Cost Summary & Shipping Total
    const summaryCard = page.locator(".lg\\:col-span-5");
    await expect(summaryCard.getByText("Subtotal Produk")).toBeVisible();
    await expect(summaryCard.getByText("Rp 30.000").first()).toBeVisible();
    await expect(summaryCard.getByText("Biaya Pengiriman (Instant Courier)")).toBeVisible();
    await expect(summaryCard.getByText("Rp 20.000")).toBeVisible();
    await expect(summaryCard.getByText("Cold Chain Packaging")).toBeVisible();
    await expect(summaryCard.getByText("Rp 5.000")).toBeVisible();
    await expect(summaryCard.getByText("Rp 55.000")).toBeVisible();

    // Fill customer required form
    await page.locator('input[name="name"]').fill("Budi Santoso");
    await page.locator('input[name="whatsapp"]').fill("08123456789");
    await page.locator('textarea[name="address"]').fill("Jl. Bambu Apus No. 12, Cipayung");

    // Submit checkout
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Step 2: Redirect to Confirmation Page with Order & Payment details
    await page.waitForURL(`**/return?order_id=${MOCK_ORDER_ID}`);

    // Verify Order Status & Order Number
    await expect(page.getByText("Pesanan Berhasil!")).toBeVisible();
    await expect(page.getByText(MOCK_ORDER_NUMBER)).toBeVisible();
    await expect(page.getByText("CONFIRMED")).toBeVisible();
    await expect(page.getByText("Rp 55.000")).toBeVisible();

    // Task 2 & 3: Verify Payment Status is PENDING_PAYMENT
    await expect(page.getByText("Status Pembayaran")).toBeVisible();
    await expect(page.getByText("PENDING_PAYMENT")).toBeVisible();

    // Task 3: Customer sees QRIS Instruction Card
    await expect(page.getByText("Instruksi Pembayaran QRIS")).toBeVisible();
    await expect(page.getByText("QRIS Standar Pembayaran Nasional")).toBeVisible();
    await expect(page.getByText("CALLME YOGHURT INDONESIA")).toBeVisible();
    await expect(page.getByText("30 Menit")).toBeVisible();
    await expect(page.getByText("Panduan Pembayaran:")).toBeVisible();

    // Task 3: Payment confirmation required action
    const confirmButton = page.getByRole("button", { name: /Saya Sudah Membayar/i });
    await expect(confirmButton).toBeVisible();

    const waButton = page.getByRole("link", { name: /Konfirmasi via WhatsApp Resmi/i });
    await expect(waButton).toBeVisible();
    const waHref = await waButton.getAttribute("href");
    expect(waHref).toContain("wa.me");
    expect(waHref).toContain("CY-2026-0001");

    // Click "Saya Sudah Membayar"
    await confirmButton.click();
    await expect(page.getByText("Konfirmasi Diterima! Tim admin sedang memverifikasi pembayaran Anda.")).toBeVisible();

    // Capture payment confirmation screenshot
    const paymentScreenshotPath = path.join(ARTIFACTS_DIR, "payment_qris_confirmation.png");
    await page.screenshot({ path: paymentScreenshotPath, fullPage: true });
    console.log(`Saved payment QRIS screenshot: ${paymentScreenshotPath}`);
  });
});
