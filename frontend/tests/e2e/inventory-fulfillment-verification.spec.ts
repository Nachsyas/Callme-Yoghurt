import { test, expect } from "@playwright/test";
import * as path from "path";
import { createAdminSessionToken } from "../../src/lib/auth/admin-session.ts";

const ARTIFACTS_DIR = "/Users/user/.gemini/antigravity-ide/brain/84493374-de71-4ba1-9395-94d6aa88099c";

test.describe("Phase 1.7C.17 — Order Fulfillment & Inventory Integration E2E", () => {
  test.beforeEach(async ({ context }) => {
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

  test("E2E Verification: Order Detail with Inventory Status & Audit Log", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Open Admin Orders page
    await page.goto("/admin/orders");
    await expect(page.getByRole("heading", { name: "Manajemen Pesanan & Fulfillment" })).toBeVisible();

    // Select order CMY-20260926-0001
    const orderRow = page.locator("tr:has-text('CMY-20260926-0001')").first();
    await expect(orderRow).toBeVisible();
    await orderRow.getByRole("button", { name: "Detail" }).click();

    const orderDrawer = page.locator("section[aria-labelledby='order-detail-title']");
    await expect(orderDrawer).toBeVisible();
    await expect(orderDrawer.locator("#order-detail-title")).toHaveText("CMY-20260926-0001");

    // Click Confirm Payment to trigger Task 1 & 4 Inventory Reservation
    const confirmPaymentBtn = orderDrawer.getByRole("button", { name: "Confirm Payment" });
    if (await confirmPaymentBtn.isVisible() && await confirmPaymentBtn.isEnabled()) {
      await confirmPaymentBtn.click();
    }

    // Verify Task 5: Inventory Status displays "✓ Stock Reserved"
    await expect(orderDrawer.getByText("✓ Stock Reserved")).toBeVisible();
    await expect(orderDrawer.getByText("Alokasi Stok Per Item")).toBeVisible();
    await expect(orderDrawer.getByText("Plain Pure Original").first()).toBeVisible();
    await expect(orderDrawer.getByText(/Reserved:\s*2/i)).toBeVisible();
    await expect(orderDrawer.getByText("READY").first()).toBeVisible();

    // Verify Task 6: Fulfillment Audit Log
    await expect(orderDrawer.getByText("Riwayat Audit Fulfillment")).toBeVisible();
    await expect(orderDrawer.getByText("ORDER_PAYMENT_CONFIRMED").first()).toBeVisible();
    await expect(orderDrawer.getByText("INVENTORY_RESERVED").first()).toBeVisible();

    // Capture required screenshot: admin order with inventory status (Task 5 & 8)
    const screenshotPath = path.join(ARTIFACTS_DIR, "admin_order_inventory_status.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved admin order inventory status screenshot to: ${screenshotPath}`);

    // Verify transition to PROCESSING
    const processingBtn = orderDrawer.getByRole("button", { name: "Ubah ke: PROCESSING" });
    await expect(processingBtn).toBeVisible();
    await processingBtn.click();
    await expect(orderDrawer.getByText("PROCESSING").first()).toBeVisible();
    await expect(orderDrawer.getByText("ORDER_PROCESSING").first()).toBeVisible();

    // Verify transition to READY_TO_SHIP
    const readyToShipBtn = orderDrawer.getByRole("button", { name: "Ubah ke: READY_TO_SHIP" });
    await expect(readyToShipBtn).toBeVisible();
    await readyToShipBtn.click();
    await expect(orderDrawer.getByText("READY_TO_SHIP").first()).toBeVisible();
    await expect(orderDrawer.getByText("✓ Fulfilled")).toBeVisible();
    await expect(orderDrawer.getByText("ORDER_READY_TO_SHIP").first()).toBeVisible();
  });
});
