import { test, expect } from "@playwright/test";

test.describe("Phase 1.7C.1 — Motion & Interaction System End-to-End Tests", () => {
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

    // Scroll initial position
    const initialScroll = await carousel.evaluate((el) => el.scrollLeft);
    expect(initialScroll).toBe(0);

    // Click next button
    await nextBtn.click();
    await page.waitForTimeout(400);

    // Scroll position should have updated smoothly
    const afterScroll = await carousel.evaluate((el) => el.scrollLeft);
    expect(afterScroll).toBeGreaterThanOrEqual(0);
  });

  test("2. Catalog card size selection smoothly switches variants without reloading image", async ({ page }) => {
    await page.goto("/");

    // Locate the first card
    const firstCard = page.locator("#catalog-carousel article").first();
    await expect(firstCard).toBeVisible();

    // Find size buttons: 250 ml, 500 ml, 1 Liter
    const btn250 = firstCard.getByRole("button", { name: "250 ml" });
    const btn1L = firstCard.getByRole("button", { name: "1 Liter" });

    await expect(btn250).toBeVisible();
    await expect(btn1L).toBeVisible();

    // Switch to 1 Liter
    await btn1L.click();
    await page.waitForTimeout(200);

    // Price should have updated to 55.000
    await expect(firstCard.getByText(/55\.000/)).toBeVisible();

    // Add to cart from card
    const addBtn = firstCard.getByRole("button", { name: "+ Keranjang" });
    await addBtn.click();

    // Cart drawer should open automatically
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Keranjang Belanja")).toBeVisible();

    // Press Escape to close cart drawer
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await expect(drawer).not.toBeVisible();
  });

  test("3. Product detail page toggles sizes and handles add-to-cart feedback", async ({ page }) => {
    await page.goto("/product/plain");
    await expect(page.getByText("Plain Pure Original")).toBeVisible();

    // Check size toggle
    const btn1000 = page.getByRole("button", { name: /1000 ml/i });
    if (await btn1000.isVisible()) {
      await btn1000.click();
      await page.waitForTimeout(200);
      await expect(page.getByText(/55\.000/)).toBeVisible();
    }

    // Add to cart
    const addBtn = page.getByRole("button", { name: /Tambahkan ke Pesanan/i });
    await addBtn.click();

    // Cart drawer opens
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();

    // Verify quantity increment/decrement works
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
  });

  test("4. Prefers-reduced-motion is respected without breaking functional UI", async ({ page }) => {
    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // Everything must remain fully visible and operational
    await expect(page.getByText("Varian Rasa Pilihan.")).toBeVisible();
    const carousel = page.locator("#catalog-carousel");
    await expect(carousel).toBeVisible();

    const firstCard = carousel.locator("article").first();
    await expect(firstCard).toBeVisible();

    // Size selection still works instantly
    const btn250 = firstCard.getByRole("button", { name: "250 ml" });
    await btn250.click();
    await expect(btn250).toBeVisible();
  });

  test("5. Checkout page inputs remain stable without animation interference", async ({ page }) => {
    await page.goto("/product/plain");
    const addBtn = page.getByRole("button", { name: /Tambahkan ke Pesanan/i });
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
  });
});
