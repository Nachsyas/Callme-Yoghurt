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
const MOCK_ORDER_NUMBER = "CMY-20260926-0001";

test.describe("Phase 1.7C.15 — Order Management & WhatsApp Receipt Foundation Verification", () => {
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
          request_id: "e2e-order-receipt-1",
          data: {
            order_id: MOCK_ORDER_ID,
            order_number: MOCK_ORDER_NUMBER,
            status: "CONFIRMED",
            total_amount: 55000,
            request_id: "e2e-order-receipt-1",
          },
        }),
      });
    });

    await page.route("**/api/shipping/quote**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            service_fee: { isConfigured: true, amount: 1000, name: "Biaya Layanan" },
            quotes: [],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            service_fee: { isConfigured: true, amount: 1000, name: "Biaya Layanan" },
            quotes: [
              {
                quote_id: "01940b50-1111-7000-8000-000000000099",
                provider: "Biteship",
                courier_name: "Grab",
                courier_code: "grab",
                service_name: "Instant",
                service_code: "instant",
                service_type: "instant",
                price: 24000,
                duration: "1-3 hours",
                cold_chain_compliant: true,
                description: "Pengiriman kilat 1-3 jam",
              },
            ],
          }),
        });
      }
    });
  });

  test("Full Verification: Checkout -> Order Created -> Order Number Generated -> Receipt Generated -> WhatsApp Link", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    // Step 1: Browse product -> add to cart
    await page.goto("/product/plain");
    await expect(page.getByText("Plain Pure Original")).toBeVisible();

    await page.getByRole("button", { name: /500\s*ml/i }).click();
    await page.getByRole("button", { name: /Tambah ke Keranjang/i }).click();

    const drawer = page.locator("#cart-drawer");
    await expect(drawer).toBeVisible();

    const checkoutCTA = drawer.getByRole("link", { name: /Lanjut ke Checkout/i });
    await checkoutCTA.click();
    await page.waitForURL("**/checkout");

    // Fill customer required checkout form
    await page.locator('input[name="name"]').fill("Budi Santoso");
    await page.locator('input[name="whatsapp"]').fill("08123456789");
    await page.locator('textarea[name="address"]').fill("Jl. Bambu Apus No. 12, Cipayung");

    // Calculate shipping and select quote
    const hitungBtn = page.getByRole("button", { name: /Hitung Ongkir Resmi/i });
    await expect(hitungBtn).toBeVisible();
    await hitungBtn.click();

    const quoteRadio = page.locator('input[value="01940b50-1111-7000-8000-000000000099"]');
    await expect(quoteRadio).toBeVisible();
    await quoteRadio.click();

    // Submit checkout
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    // Step 2: Arrive at Confirmation Page
    await page.waitForURL(`**/return?order_id=${MOCK_ORDER_ID}`);
    await expect(page.getByText("Pesanan Berhasil!")).toBeVisible();

    // Task 2: Verify Order Number
    await expect(page.getByText(MOCK_ORDER_NUMBER)).toBeVisible();

    // Task 1: Verify Order Lifecycle Status
    await expect(page.getByText("CONFIRMED")).toBeVisible();
    await expect(page.getByText("WAITING_PAYMENT")).toBeVisible();

    // Task 3: Verify Reusable Order Summary Section
    await expect(page.getByText("Ringkasan Pesanan (Order Summary)")).toBeVisible();
    await expect(page.getByText("Budi Santoso")).toBeVisible();
    await expect(page.getByText("Plain Pure Original").first()).toBeVisible();
    await expect(page.getByText("Subtotal Produk:")).toBeVisible();
    await expect(page.getByText("Ongkos Kirim:")).toBeVisible();
    await expect(page.getByText("Cold Chain Packaging:")).toBeVisible();
    await expect(page.getByText("Rp 55.000")).toBeVisible();

    // Task 4: Verify Digital Receipt Section and Action
    await expect(page.getByText("Struk Digital Resmi (Receipt)")).toBeVisible();
    const copyReceiptBtn = page.getByRole("button", { name: /Salin Struk Digital/i });
    await expect(copyReceiptBtn).toBeVisible();

    // Expand receipt text preview
    const toggleReceiptBtn = page.getByRole("button", { name: /Lihat Format Struk Teks/i });
    await expect(toggleReceiptBtn).toBeVisible();
    await toggleReceiptBtn.click();

    // Verify digital receipt formatted text content
    const receiptPre = page.locator("pre");
    await expect(receiptPre).toBeVisible();
    await expect(receiptPre).toContainText("CALLME YOGHURT");
    await expect(receiptPre).toContainText(MOCK_ORDER_NUMBER);
    await expect(receiptPre).toContainText("Subtotal:\nRp30.000");
    await expect(receiptPre).toContainText("TOTAL:\nRp55.000");
    await expect(page.getByText("Sembunyikan Struk Teks")).toBeVisible();

    // Task 5: Verify WhatsApp Receipt link generation
    const waButton = page.getByRole("link", { name: /Konfirmasi via WhatsApp Resmi/i });
    await expect(waButton).toBeVisible();
    const waHref = await waButton.getAttribute("href");
    expect(waHref).toBeTruthy();
    expect(waHref).toContain("https://wa.me/628123456789?text=");
    expect(decodeURIComponent(waHref!)).toContain(MOCK_ORDER_NUMBER);
    expect(decodeURIComponent(waHref!)).toContain("Budi Santoso");
    expect(decodeURIComponent(waHref!)).toContain("Rp55.000");

    // Task 1: Verify Payment Confirmation action transitions state to PAYMENT_CONFIRMED
    const confirmBtn = page.getByRole("button", { name: /Saya Sudah Membayar/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    await expect(page.getByText("PAYMENT_CONFIRMED")).toBeVisible();
    await expect(page.getByText("Konfirmasi Diterima! Tim admin sedang memverifikasi pembayaran Anda.")).toBeVisible();

    // Capture screenshot for final report
    const screenshotPath = path.join(ARTIFACTS_DIR, "order_receipt_confirmation.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved confirmation screenshot to: ${screenshotPath}`);
  });
});
