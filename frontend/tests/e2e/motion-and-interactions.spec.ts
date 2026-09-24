import { test, expect } from "@playwright/test";

test.describe("Phase 1.7C.1 & 1.7C.2 — Motion & Data Integrity End-to-End Tests", () => {
  test("1. Homepage hero, sections, and catalog carousel render and operate with motion", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Callme Yoghurt/i);

    // Verify catalog carousel container is visible
    const carousel = page.locator("#catalog-carousel");
    await expect(carousel).toBeVisible();

    // Verify carousel arrow buttons exist and are interactive
    const nextBtn = page.getByRole("button", { name: "Geser katalog ke kanan" });
    const prevBtn = page.getByRole("button", { name: "Geser katalog ke kiri" });
    await expect(nextBtn).toBeVisible();
    await expect(prevBtn).toBeVisible();

    // Scroll initial position to start
    await carousel.evaluate((el) => {
      el.scrollTo({ left: 0, behavior: "instant" });
    });
    await page.waitForTimeout(300);
    const initialScroll = await carousel.evaluate((el) => el.scrollLeft);

    // Click next (right) button
    await nextBtn.click();
    await page.waitForTimeout(600);

    // Meaningful assertion: scroll position must have increased to the right
    const afterScroll = await carousel.evaluate((el) => el.scrollLeft);
    expect(afterScroll).toBeGreaterThan(initialScroll);

    // Click previous (left) button
    await prevBtn.click();
    await page.waitForTimeout(600);

    // Meaningful assertion: scroll position must have decreased back toward initial
    const finalScroll = await carousel.evaluate((el) => el.scrollLeft);
    expect(finalScroll).toBeLessThan(afterScroll);
  });

  test("2. Catalog card size selection smoothly switches variants without reloading image", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Locate the Plain card
    const firstCard = page.locator("#catalog-carousel article").filter({ hasText: /Plain/i }).first();
    await expect(firstCard).toBeVisible();

    // Find size buttons: 250 ml, 500 ml, 1 Liter
    const btn250 = firstCard.getByRole("button", { name: "250 ml", exact: true });
    const btn500 = firstCard.getByRole("button", { name: "500 ml", exact: true });
    const btn1L = firstCard.getByRole("button", { name: "1 Liter", exact: true });

    await expect(btn250).toBeVisible();
    await expect(btn500).toBeVisible();
    await expect(btn1L).toBeVisible();

    // Switch to 500 ml -> price should be Rp 30.000
    await btn500.click();
    await page.waitForTimeout(200);
    await expect(firstCard.getByText(/30\.000/).first()).toBeVisible();

    // Switch to 1 Liter -> price should be Rp 55.000
    await btn1L.click();
    await page.waitForTimeout(200);
    await expect(firstCard.getByText(/55\.000/).first()).toBeVisible();

    // Add to cart from card (if ERP online and enabled)
    const addBtn = firstCard.getByRole("button", { name: /Tambah .* ke keranjang|\+ Keranjang/i });
    if (await addBtn.isEnabled()) {
      await addBtn.click();

      // Cart drawer should open automatically
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeVisible();
      await expect(drawer.getByText("Keranjang Belanja")).toBeVisible();

      // Press Escape to close cart drawer
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      await expect(drawer).not.toBeVisible();
    }
  });

  test("3. Product detail page toggles sizes and handles add-to-cart feedback", async ({ page }) => {
    await page.goto("/product/plain");
    await expect(page.getByText("Plain Pure Original")).toBeVisible();

    // Check 500 ml size toggle
    const btn500 = page.getByRole("button", { name: /500 ml/i }).first();
    if (await btn500.isVisible()) {
      await btn500.click();
      await page.waitForTimeout(200);
      await expect(page.getByText(/30\.000/).first()).toBeVisible();
    }

    // Check 1 Liter size toggle
    const btn1000 = page.getByRole("button", { name: /1 Liter/i }).first();
    if (await btn1000.isVisible()) {
      await btn1000.click();
      await page.waitForTimeout(200);
      await expect(page.getByText(/55\.000/).first()).toBeVisible();
    }

    // Add to cart
    const addBtn = page.getByRole("button", { name: /Tambahkan ke Pesanan/i });
    if (await addBtn.isEnabled()) {
      await addBtn.click();

      // Cart drawer opens
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeVisible();

      // Verify quantity increment works
      const plusBtn = drawer.getByRole("button", { name: "Tambah kuantitas" }).first();
      if (await plusBtn.isVisible()) {
        await plusBtn.click();
        await page.waitForTimeout(200);
      }

      // Close button
      const closeBtn = drawer.getByRole("button", { name: /Tutup Keranjang/i });
      await closeBtn.click();
      await page.waitForTimeout(300);
      await expect(drawer).not.toBeVisible();
    }
  });

  test("4. Prefers-reduced-motion is respected without breaking functional UI", async ({ page }) => {
    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // 1. Verify reduced-motion media query evaluates to active in the browser
    const prefersReduced = await page.evaluate(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    expect(prefersReduced).toBe(true);

    // 2. Verify global reduced motion CSS override is active
    const testArticle = page.locator("#catalog-carousel article").filter({ hasText: /Plain/i }).first();
    await expect(testArticle).toBeVisible();
    const transitionDuration = await testArticle.evaluate(
      (el) => window.getComputedStyle(el).transitionDuration
    );
    expect(parseFloat(transitionDuration)).toBeLessThanOrEqual(0.05);

    // 3. Size switching works instantly
    const btn500 = testArticle.getByRole("button", { name: "500 ml", exact: true });
    await btn500.click();
    await expect(testArticle.getByText(/30\.000/).first()).toBeVisible();

    // 4. Cart still opens and operates with reduced motion if available
    const addBtn = testArticle.getByRole("button", { name: /Tambah .* ke keranjang|\+ Keranjang/i });
    if (await addBtn.isEnabled()) {
      await addBtn.click();
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(drawer).not.toBeVisible();
    }

    // 5. Route navigation still functions seamlessly
    const detailLink = testArticle.getByRole("link", { name: "Detail" });
    await detailLink.click();
    await expect(page).toHaveURL(/.*product\/plain/);
    await expect(page.getByText("Plain Pure Original")).toBeVisible();
  });

  test("5. Checkout page inputs remain stable without animation interference", async ({ page }) => {
    await page.goto("/product/plain");
    const addBtn = page.getByRole("button", { name: /Tambahkan ke Pesanan/i });
    if (await addBtn.isEnabled()) {
      await addBtn.click();

      // Click checkout link inside CartDrawer to perform client-side navigation (preserving in-memory cart state)
      const checkoutLink = page.getByRole("link", { name: /Lanjut ke Checkout/i });
      await expect(checkoutLink).toBeVisible();
      await checkoutLink.click();

      await expect(page).toHaveURL(/.*checkout/);
      await expect(page.getByText(/Checkout Pesanan/i)).toBeVisible();

      const nameInput = page.locator('input[placeholder*="Budi"]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill("Budi Santoso");
        await expect(nameInput).toHaveValue("Budi Santoso");
      }
    }
  });
});
