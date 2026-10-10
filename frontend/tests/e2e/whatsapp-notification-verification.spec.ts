import { test, expect } from "@playwright/test";
import * as path from "path";
import { createAdminSessionToken } from "../../src/lib/auth/admin-session.ts";

const ARTIFACTS_DIR = "/Users/user/.gemini/antigravity-ide/brain/84493374-de71-4ba1-9395-94d6aa88099c";

test.describe("Phase 1.7C.18 — WhatsApp Notification Foundation E2E", () => {
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

  test("E2E Verification: Order Detail with WhatsApp Notification History", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 950 });

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

    // Task 7: Verify Notification History Card is visible
    await expect(orderDrawer.getByText("Riwayat Notifikasi WhatsApp")).toBeVisible();
    await expect(orderDrawer.getByText("WhatsApp message generated").first()).toBeVisible();

    // Verify WhatsApp action button exists with valid wa.me link
    const waButton = orderDrawer.locator("a:has-text('Buka WhatsApp (Manual)')").first();
    await expect(waButton).toBeVisible();
    const href = await waButton.getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/62\d+\?text=/);

    // Click Confirm Payment if WAITING_PAYMENT to trigger PAYMENT_CONFIRMED notification
    const confirmPaymentBtn = orderDrawer.getByRole("button", { name: "Confirm Payment" });
    if (await confirmPaymentBtn.isVisible() && await confirmPaymentBtn.isEnabled()) {
      await confirmPaymentBtn.click();
      await page.waitForTimeout(500);
      await expect(orderDrawer.getByText("PAYMENT_CONFIRMED").first()).toBeVisible();
    }

    // Scroll to Riwayat Notifikasi WhatsApp to ensure optimal screenshot view
    const notifSection = orderDrawer.getByText("Riwayat Notifikasi WhatsApp");
    await notifSection.scrollIntoViewIfNeeded();

    // Capture required screenshot: admin order detail with notification history
    const screenshotPath = path.join(ARTIFACTS_DIR, "admin_order_notification_history.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved notification history screenshot to: ${screenshotPath}`);

    // Advance to PROCESSING and verify new notification is appended
    const processingBtn = orderDrawer.getByRole("button", { name: "Ubah ke: PROCESSING" });
    if (await processingBtn.isVisible() && await processingBtn.isEnabled()) {
      await processingBtn.click();
      await page.waitForTimeout(500);
      await expect(orderDrawer.getByText("ORDER_PROCESSING").first()).toBeVisible();
    }
  });
});
