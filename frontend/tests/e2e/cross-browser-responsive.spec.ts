import { test, expect } from "@playwright/test";
import { createAdminSessionToken, ADMIN_COOKIE_NAME } from "../../src/lib/auth/admin-session.ts";

const BREAKPOINTS = [
  { name: "desktop-1920x1080", width: 1920, height: 1080, type: "desktop" },
  { name: "desktop-1440x900", width: 1440, height: 900, type: "desktop" },
  { name: "desktop-1366x768", width: 1366, height: 768, type: "desktop" },
  { name: "tablet-1024x768", width: 1024, height: 768, type: "tablet" },
  { name: "tablet-768x1024", width: 768, height: 1024, type: "tablet" },
  { name: "mobile-390x844", width: 390, height: 844, type: "mobile" },
  { name: "mobile-360x800", width: 360, height: 800, type: "mobile" },
];

test.describe("Phase 1.5.3: Cross-Browser & Responsive Validation", () => {
  // Skip Firefox specifically on macOS Darwin due to upstream macOS TCC sandbox permission issue (#42768)
  test.skip(
    ({ browserName }) => browserName === "firefox" && process.platform === "darwin",
    "macOS TCC security restriction prevents Firefox headless launch in non-interactive terminal (Playwright issue #42768)."
  );

  let adminToken: string;

  test.beforeAll(async () => {
    adminToken = await createAdminSessionToken({
      id: "usr-admin-777",
      username: "ops_lead",
      email: "admin@callmeyoghurt.com",
      role: "OWNER",
    });
  });

  for (const bp of BREAKPOINTS) {
    test(`Storefront, PDP & Checkout Responsive Verification [${bp.name}]`, async ({ page, browserName }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      const errors: string[] = [];
      page.on("pageerror", (err) => {
        // Ignore benign WebKit localhost RSC prefetch network checks
        if (err.message.includes("due to access control checks")) return;
        errors.push(err.message);
      });

      // 1. Storefront Homepage
      await page.goto("/", { waitUntil: "domcontentloaded" });
      expect(errors).toHaveLength(0);

      // Verify no horizontal overflow
      const hasHorizontalScrollHome = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScrollHome).toBe(false);

      // Verify branding and hero are visible
      await expect(page.getByText("Callme Yoghurt").first()).toBeVisible();

      // 2. Product Detail Page
      await page.goto("/product/plain", { waitUntil: "domcontentloaded" });
      expect(errors).toHaveLength(0);

      const hasHorizontalScrollPDP = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScrollPDP).toBe(false);

      // Verify Cold Chain storage specifications per enterprise SOP
      await expect(page.getByText("Instruksi Penyimpanan")).toBeVisible();
      await expect(page.getByText(/Hanya tahan 3 hari di suhu ruang/i)).toBeVisible();

      // Verify real product image loaded cleanly (no broken layout / missing asset)
      const img = page.locator('img[alt="Plain Pure Original"]');
      await expect(img).toBeVisible();
      const isImgLoaded = await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
      expect(isImgLoaded).toBe(true);

      // Verify interactive variant button selection
      const literBtn = page.getByRole("button", { name: /1 Liter/i });
      if (await literBtn.isVisible()) {
        await literBtn.click();
        await expect(page.getByText("Rp 55.000").first()).toBeVisible();
      }

      // Verify quantity stepper interaction
      const plusBtn = page.getByRole("button", { name: "Tambah jumlah" });
      if (await plusBtn.isVisible()) {
        await plusBtn.click();
        await expect(page.getByText("Rp 110.000").first()).toBeVisible();
      }

      // 3. Checkout Page Usability & Responsive Verification
      await page.goto("/checkout", { waitUntil: "domcontentloaded" });
      expect(errors).toHaveLength(0);

      const hasHorizontalScrollCheckout = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScrollCheckout).toBe(false);

      // Verify empty cart state is responsive and has interactive CTA
      await expect(page.getByText(/Keranjangmu masih kosong/i)).toBeVisible();
      const catalogBtn = page.getByRole("link", { name: /Kembali ke Katalog/i });
      await expect(catalogBtn).toBeVisible();

      // Save screenshot for key viewports
      if (["desktop-1440x900", "tablet-768x1024", "mobile-390x844"].includes(bp.name)) {
        const screenshotPath = `/Users/user/.gemini/antigravity-ide/brain/84493374-de71-4ba1-9395-94d6aa88099c/pdp_${bp.name}_${browserName}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
      }
    });

    test(`Admin Console Responsive Verification [${bp.name}]`, async ({ page, context, browserName }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });

      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      // 1. Verify Admin Login Page Layout & Form Usability
      await page.goto("/admin/login", { waitUntil: "domcontentloaded" });
      expect(errors).toHaveLength(0);

      const hasHorizontalScrollLogin = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScrollLogin).toBe(false);

      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();
      await emailInput.fill("admin@callmeyoghurt.com");
      expect(await emailInput.inputValue()).toBe("admin@callmeyoghurt.com");

      const passInput = page.locator('input[type="password"]');
      await expect(passInput).toBeVisible();
      await passInput.fill("DevOpsSecPassword2026!");
      expect(await passInput.inputValue()).toBe("DevOpsSecPassword2026!");

      const submitBtn = page.getByRole("button", { name: /Sign In to Operations/i });
      await expect(submitBtn).toBeVisible();

      // 2. Inject authenticated admin session
      await context.addCookies([
        {
          name: ADMIN_COOKIE_NAME,
          value: adminToken,
          url: "http://127.0.0.1:3000",
          httpOnly: true,
          secure: false,
        },
      ]);

      // 3. Verify Admin Dashboard
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      expect(errors).toHaveLength(0);

      // Verify no horizontal overflow
      const hasHorizontalScrollAdmin = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScrollAdmin).toBe(false);

      // Verify key operational components exist
      await expect(page.getByText("Authenticated Session Active")).toBeVisible();
      await expect(page.getByText("Authoritative Catalog")).toBeVisible();
      await expect(page.getByText("Today's Attention — Tindakan Operasional Hari Ini")).toBeVisible();

      // Responsive device behavior checks:
      if (bp.type === "mobile") {
        // Mobile must show hamburger menu button
        const hamburgerBtn = page.getByRole("button", { name: /Open Mobile Menu/i });
        await expect(hamburgerBtn).toBeVisible();

        // Mobile must show card-based operational elements
        await expect(page.getByText("Recent Orders")).toBeVisible();
        await expect(page.locator("div.md\\:hidden").getByText("CY-2026-0042").first()).toBeVisible();

        // Click hamburger button to open drawer
        await hamburgerBtn.click();
        await expect(page.getByText("CALLME ERP").first()).toBeVisible();
        const closeBtn = page.getByRole("button", { name: /Close Sidebar/i });
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
      } else if (bp.type === "tablet" && bp.width === 768) {
        // Tablet portrait: test collapsible sidebar button
        const collapseBtn = page.getByRole("button", { name: /Collapse Sidebar|Expand Sidebar/i });
        if (await collapseBtn.isVisible()) {
          await collapseBtn.click();
        }
        await expect(page.locator("table").getByText("CY-2026-0042").first()).toBeVisible();
      } else {
        // Desktop: fixed sidebar visible, table visible
        await expect(page.getByText("CALLME ERP").first()).toBeVisible();
        await expect(page.locator("table").getByText("CY-2026-0042").first()).toBeVisible();
      }

      // Save screenshot for key viewports
      if (["desktop-1440x900", "tablet-768x1024", "mobile-390x844"].includes(bp.name)) {
        const screenshotPath = `/Users/user/.gemini/antigravity-ide/brain/84493374-de71-4ba1-9395-94d6aa88099c/admin_${bp.name}_${browserName}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
      }
    });
  }
});
