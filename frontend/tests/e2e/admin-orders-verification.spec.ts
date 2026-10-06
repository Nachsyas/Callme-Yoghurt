import { test, expect } from "@playwright/test";
import * as path from "path";
import { createAdminSessionToken } from "../../src/lib/auth/admin-session.ts";

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

test.describe("Phase 1.7C.16 — Admin Order Management & Fulfillment Dashboard E2E", () => {
  test.beforeEach(async ({ context }) => {
    // Inject valid admin session token to bypass auth gate safely
    const token = await createAdminSessionToken({
      id: "admin-owner-test",
      username: "owner_admin",
      email: "owner@callmeyoghurt.com",
      role: "OWNER",
    });

    await context.addCookies([
      {
        name: "callme_admin_session",
        value: token,
        url: "http://127.0.0.1:3000",
      },
    ]);
  });

  test("Complete E2E: Customer Checkout -> Admin Orders List -> Order Detail Drawer -> Status Update -> Rejection of Invalid Transitions", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Step 1: Customer Browse & Checkout
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
          request_id: "e2e-order-admin-1",
          data: {
            order_id: MOCK_ORDER_ID,
            order_number: MOCK_ORDER_NUMBER,
            status: "CONFIRMED",
            total_amount: 55000,
            request_id: "e2e-order-admin-1",
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

    await page.goto("/product/plain");
    await expect(page.getByText("Plain Pure Original")).toBeVisible();
    await page.getByRole("button", { name: /500\s*ml/i }).click();
    await page.getByRole("button", { name: /Tambah ke Keranjang/i }).click();

    const drawer = page.locator("#cart-drawer");
    await expect(drawer).toBeVisible();
    const checkoutCTA = drawer.getByRole("link", { name: /Lanjut ke Checkout/i });
    await checkoutCTA.click();
    await page.waitForURL("**/checkout");

    // Fill customer checkout fields
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
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();
    await page.waitForURL("**/return?order_id=*");
    await expect(page.getByText("Pesanan Berhasil!")).toBeVisible();

    // Step 2: Admin Opens /admin/orders (Task 1 & Task 6)
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Manajemen Pesanan & Fulfillment" })).toBeVisible();

    // Verify Task 6 Dashboard Summary Cards
    await expect(page.getByText("Today's Orders")).toBeVisible();
    await expect(page.getByText("Waiting Payment").first()).toBeVisible();
    await expect(page.getByText("Processing").first()).toBeVisible();
    await expect(page.getByText("Ready To Ship").first()).toBeVisible();
    await expect(page.getByText("Completed Orders")).toBeVisible();

    // Verify Task 1 Orders Table columns and data
    const orderRow = page.locator(`tr:has-text("${MOCK_ORDER_NUMBER}")`).first();
    await expect(orderRow).toBeVisible();
    await expect(orderRow.getByText("Budi Santoso")).toBeVisible();
    await expect(orderRow.getByText("08123456789")).toBeVisible();
    await expect(orderRow.getByText("PENDING_PAYMENT")).toBeVisible();
    await expect(orderRow.getByText("WAITING_PAYMENT")).toBeVisible();
    await expect(orderRow.getByText("Rp 55.000")).toBeVisible();

    // Capture Screenshot 1: Order List
    const listScreenshotPath = path.join(ARTIFACTS_DIR, "admin_order_list.png");
    await page.screenshot({ path: listScreenshotPath, fullPage: true });
    console.log(`Saved order list screenshot: ${listScreenshotPath}`);

    // Step 3: Open Order Detail View Drawer (Task 2 & Task 4)
    await orderRow.getByRole("button", { name: "Detail" }).click();

    // Verify Drawer opens
    const orderDrawer = page.locator("section[aria-labelledby='order-detail-title']");
    await expect(orderDrawer).toBeVisible();
    await expect(orderDrawer.locator("#order-detail-title")).toHaveText(MOCK_ORDER_NUMBER);

    // Verify Customer Info in Drawer
    await expect(orderDrawer.getByText("Customer Information")).toBeVisible();
    await expect(orderDrawer.getByText("Budi Santoso", { exact: true })).toBeVisible();
    await expect(orderDrawer.getByText("08123456789", { exact: true })).toBeVisible();
    await expect(orderDrawer.getByText(/Jl\. Bambu Apus No\. 12, Cipayung/i)).toBeVisible();

    // Verify Items
    await expect(orderDrawer.getByText("Plain Pure Original").first()).toBeVisible();
    await expect(orderDrawer.getByText(/Varian: 500ml/i).first()).toBeVisible();

    // Verify Cost Breakdown
    await expect(orderDrawer.getByText("Cost Breakdown")).toBeVisible();
    await expect(orderDrawer.getByText("Rp 30.000").first()).toBeVisible(); // Subtotal
    await expect(orderDrawer.getByText("Rp 20.000").first()).toBeVisible(); // Shipping
    await expect(orderDrawer.getByText("Rp 5.000").first()).toBeVisible();  // Cold Chain
    await expect(orderDrawer.getByText("Rp 55.000").first()).toBeVisible(); // Total

    // Verify Task 4 Payment Verification UI Placeholder
    await expect(orderDrawer.getByText("Payment Verification")).toBeVisible();
    await expect(orderDrawer.getByText("Waiting Verification").first()).toBeVisible();
    const confirmPaymentBtn = orderDrawer.getByRole("button", { name: "Confirm Payment" });
    const rejectPaymentBtn = orderDrawer.getByRole("button", { name: "Reject Payment" });
    await expect(confirmPaymentBtn).toBeVisible();
    await expect(rejectPaymentBtn).toBeVisible();

    // Capture Screenshot 2: Order Detail Drawer
    const detailScreenshotPath = path.join(ARTIFACTS_DIR, "admin_order_detail.png");
    await page.screenshot({ path: detailScreenshotPath, fullPage: true });
    console.log(`Saved order detail screenshot: ${detailScreenshotPath}`);

    // Step 4: Status Update: WAITING_PAYMENT to PAYMENT_CONFIRMED (Task 3 & 4)
    await confirmPaymentBtn.click();

    // Verify status updated to PAYMENT_CONFIRMED
    await expect(orderDrawer.getByText("PAYMENT_CONFIRMED").first()).toBeVisible();
    await expect(orderDrawer.getByText("Terverifikasi").first()).toBeVisible();

    // Capture Screenshot 3: Status Update
    const updateScreenshotPath = path.join(ARTIFACTS_DIR, "admin_order_status_update.png");
    await page.screenshot({ path: updateScreenshotPath, fullPage: true });
    console.log(`Saved status update screenshot: ${updateScreenshotPath}`);

    // Step 5: Verify invalid transitions are strictly rejected (Task 3)
    // From PAYMENT_CONFIRMED, the only valid next forward status is PROCESSING.
    // CANCELLED or DELIVERED must NOT be available as options.
    await expect(orderDrawer.getByRole("button", { name: "Ubah ke: PROCESSING" })).toBeVisible();
    await expect(orderDrawer.getByRole("button", { name: "Ubah ke: DELIVERED" })).toHaveCount(0);
    await expect(orderDrawer.getByRole("button", { name: "Ubah ke: CANCELLED" })).toHaveCount(0);

    // Verify backend BFF rejects invalid transition attempt (e.g. attempting to jump to DELIVERED)
    const token = await createAdminSessionToken({
      id: "admin-owner-test",
      username: "owner_admin",
      email: "owner@callmeyoghurt.com",
      role: "OWNER",
    });

    const invalidTransitionResponse = await request.patch(
      `/api/admin/orders/${MOCK_ORDER_NUMBER}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        data: {
          status: "DELIVERED",
        },
      }
    );

    expect(invalidTransitionResponse.status()).toBe(422);
    const errorJson = await invalidTransitionResponse.json();
    expect(errorJson.error).toContain("tidak valid");
    console.log("Verified invalid status transition successfully rejected with HTTP 422:", errorJson.error);
  });
});
