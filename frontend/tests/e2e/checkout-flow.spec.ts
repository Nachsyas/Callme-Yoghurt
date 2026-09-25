import { test, expect } from "@playwright/test";

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
          price: { amount: 15000, currency: "IDR" },
        },
        {
          variant_id: "018f6c38-8c50-711e-b8d4-53a8be77e441",
          sku: "CY-PLO-1000",
          name: "Plain Pure Original 1000ml",
          net_content: { quantity: "1000.000000", uom: "ML" },
          price: { amount: 55000, currency: "IDR" },
        },
      ],
    },
  ],
};

const MOCK_ORDER_ID = "018f6c38-8c50-711e-b8d4-53a8be77e440";
const MOCK_ORDER_NUMBER = "CY-2026-0001";

test.describe("Browser Checkout Production Flow (Gate 0E.2C)", () => {
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

  test("Scenario 1 — Successful Checkout: product -> cart -> checkout -> confirmation", async ({ page }) => {
    let checkoutRequestCaptured = false;
    let capturedIdempotencyKey: string | null = null;

    await page.route("**/api/checkout", async (route) => {
      checkoutRequestCaptured = true;
      capturedIdempotencyKey = route.request().headers()["idempotency-key"] || null;

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
        body: JSON.stringify({
          success: true,
          request_id: "e2e-req-1",
          data: {
            order_id: MOCK_ORDER_ID,
            order_number: MOCK_ORDER_NUMBER,
            status: "CONFIRMED",
            total_amount: 15000,
            request_id: "e2e-req-1",
          },
        }),
      });
    });

    await page.goto("/product/plain");
    await expect(page.getByText("Plain Pure Original")).toBeVisible();

    const addToCartButton = page.getByRole("button", { name: /Tambahkan ke Pesanan/i });
    await expect(addToCartButton).toBeVisible();
    await addToCartButton.click();

    await page.waitForURL("**/checkout");
    await expect(page.getByText("Ringkasan Pesanan")).toBeVisible();
    await expect(page.getByText("Plain Pure Original 250ml")).toBeVisible();

    await page.locator("input[name=\"name\"]").fill("Budi Santoso");
    await page.locator("input[name=\"whatsapp\"]").fill("08123456789");
    await page.locator("textarea[name=\"address\"]").fill("Jl. Merdeka No. 10, Jakarta Pusat");

    const submitButton = page.locator("button[type=\"submit\"]");
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await page.waitForURL(`**/return?order_id=${MOCK_ORDER_ID}`);

    expect(checkoutRequestCaptured).toBe(true);
    expect(capturedIdempotencyKey).toBeTruthy();
    await expect(page.getByText("Pesanan Berhasil!")).toBeVisible();
    await expect(page.getByText(MOCK_ORDER_NUMBER)).toBeVisible();
    await expect(page.getByText("CONFIRMED")).toBeVisible();
    await expect(page.getByText("Rp 15.000")).toBeVisible();
  });

  test("Scenario 2 — Double Submit Protection: rapid clicks do not create duplicate transactions", async ({ page }) => {
    let checkoutRequestCount = 0;
    const receivedIdempotencyKeys: string[] = [];

    await page.route("**/api/checkout", async (route) => {
      checkoutRequestCount++;
      const idKey = route.request().headers()["idempotency-key"];
      if (idKey) receivedIdempotencyKeys.push(idKey);

      await new Promise((resolve) => setTimeout(resolve, 300));

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
        body: JSON.stringify({
          success: true,
          request_id: "e2e-double-submit",
          data: {
            order_id: MOCK_ORDER_ID,
            order_number: MOCK_ORDER_NUMBER,
            status: "CONFIRMED",
            total_amount: 15000,
            request_id: "e2e-double-submit",
          },
        }),
      });
    });

    await page.goto("/product/plain");
    const addToCartButton = page.getByRole("button", { name: /Tambahkan ke Pesanan/i });
    await addToCartButton.click();

    await page.waitForURL("**/checkout");
    await page.locator("input[name=\"name\"]").fill("Budi Santoso");
    await page.locator("input[name=\"whatsapp\"]").fill("08123456789");
    await page.locator("textarea[name=\"address\"]").fill("Jl. Merdeka No. 10, Jakarta Pusat");

    const submitButton = page.locator("button[type=\"submit\"]");
    await expect(submitButton).toBeEnabled();

    await submitButton.click();
    await expect(submitButton).toBeDisabled();

    await submitButton.click({ force: true }).catch(() => {});

    await page.waitForURL(`**/return?order_id=${MOCK_ORDER_ID}`);

    expect(checkoutRequestCount).toBe(1);
    expect(receivedIdempotencyKeys.length).toBe(1);
    await expect(page.getByText("Pesanan Berhasil!")).toBeVisible();
  });

  test("Scenario 3 — Refresh Confirmation Page: confirmation remains valid and cart remains cleared", async ({ page }) => {
    let checkoutRequestCount = 0;

    await page.route("**/api/checkout", async (route) => {
      checkoutRequestCount++;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        headers: {
          "Cache-Control": "no-store",
          Pragma: "no-cache",
        },
        body: JSON.stringify({
          success: true,
          request_id: "e2e-refresh-test",
          data: {
            order_id: MOCK_ORDER_ID,
            order_number: MOCK_ORDER_NUMBER,
            status: "CONFIRMED",
            total_amount: 15000,
            request_id: "e2e-refresh-test",
          },
        }),
      });
    });

    await page.goto("/product/plain");
    await page.getByRole("button", { name: /Tambahkan ke Pesanan/i }).click();

    await page.waitForURL("**/checkout");
    await page.locator("input[name=\"name\"]").fill("Budi Santoso");
    await page.locator("input[name=\"whatsapp\"]").fill("08123456789");
    await page.locator("textarea[name=\"address\"]").fill("Jl. Merdeka No. 10, Jakarta Pusat");
    await page.locator("button[type=\"submit\"]").click();

    await page.waitForURL(`**/return?order_id=${MOCK_ORDER_ID}`);
    await expect(page.getByText("Pesanan Berhasil!")).toBeVisible();
    await expect(page.getByText(MOCK_ORDER_NUMBER)).toBeVisible();

    const checkoutCallsBeforeRefresh = checkoutRequestCount;

    await page.reload();

    await expect(page.getByText("Pesanan Berhasil!")).toBeVisible();
    await expect(page.getByText(MOCK_ORDER_NUMBER)).toBeVisible();
    await expect(page.getByText("CONFIRMED")).toBeVisible();
    await expect(page.getByText("Rp 15.000")).toBeVisible();

    expect(checkoutRequestCount).toBe(checkoutCallsBeforeRefresh);

    await page.goto("/checkout");
    await expect(page.getByText("Keranjangmu masih kosong")).toBeVisible();
  });

  test("Scenario 4 — Invalid Confirmation URL: fails closed without fake success", async ({ page }) => {
    await page.goto("/return?order_id=random-invalid-id");

    await expect(page.getByText("Konfirmasi Tidak Ditemukan")).toBeVisible();
    await expect(page.getByText("Pesanan Berhasil!")).not.toBeVisible();
    await expect(page.getByRole("link", { name: /Kembali ke Beranda/i })).toBeVisible();
  });
});
