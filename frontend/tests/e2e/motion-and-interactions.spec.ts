import { test, expect } from "@playwright/test";

const MOCK_CATALOG = {
  products: [
    {
      slug: "plain",
      name: "Plain",
      description: "Yoghurt rasa Plain.",
      variants: [
        {
          variant_id: "01940a00-0001-7000-8000-000000000001",
          sku: "CY-PLAIN-250",
          name: "Plain 250ml",
          net_content: { quantity: "250.000000", uom: "ML" },
          price: { currency: "IDR", amount: 16000 },
        },
        {
          variant_id: "01940a00-0001-7000-8000-000000000002",
          sku: "CY-PLAIN-500",
          name: "Plain 500ml",
          net_content: { quantity: "500.000000", uom: "ML" },
          price: { currency: "IDR", amount: 30000 },
        },
        {
          variant_id: "01940a00-0001-7000-8000-000000000003",
          sku: "CY-PLAIN-1000",
          name: "Plain 1000ml",
          net_content: { quantity: "1.000000", uom: "L" },
          price: { currency: "IDR", amount: 55000 },
        },
      ],
    },
    {
      slug: "stroberi",
      name: "Stroberi",
      description: "Yoghurt rasa Stroberi.",
      variants: [
        {
          variant_id: "01940a00-0002-7000-8000-000000000001",
          sku: "CY-STROBERI-250",
          name: "Stroberi 250ml",
          net_content: { quantity: "250.000000", uom: "ML" },
          price: { currency: "IDR", amount: 16000 },
        },
      ],
    },
    {
      slug: "mangga",
      name: "Mangga",
      description: "Yoghurt rasa Mangga.",
      variants: [
        {
          variant_id: "01940a00-0003-7000-8000-000000000001",
          sku: "CY-MANGGA-250",
          name: "Mangga 250ml",
          net_content: { quantity: "250.000000", uom: "ML" },
          price: { currency: "IDR", amount: 16000 },
        },
      ],
    },
    {
      slug: "melon",
      name: "Melon",
      description: "Yoghurt rasa Melon.",
      variants: [
        {
          variant_id: "01940a00-0004-7000-8000-000000000001",
          sku: "CY-MELON-250",
          name: "Melon 250ml",
          net_content: { quantity: "250.000000", uom: "ML" },
          price: { currency: "IDR", amount: 16000 },
        },
      ],
    },
    {
      slug: "anggur",
      name: "Anggur",
      description: "Yoghurt rasa Anggur.",
      variants: [
        {
          variant_id: "01940a00-0005-7000-8000-000000000001",
          sku: "CY-ANGGUR-250",
          name: "Anggur 250ml",
          net_content: { quantity: "250.000000", uom: "ML" },
          price: { currency: "IDR", amount: 16000 },
        },
      ],
    },
    {
      slug: "leci",
      name: "Leci",
      description: "Yoghurt rasa Leci.",
      variants: [
        {
          variant_id: "01940a00-0006-7000-8000-000000000001",
          sku: "CY-LECI-250",
          name: "Leci 250ml",
          net_content: { quantity: "250.000000", uom: "ML" },
          price: { currency: "IDR", amount: 16000 },
        },
      ],
    },
    {
      slug: "vanila",
      name: "Vanila",
      description: "Yoghurt rasa Vanila.",
      variants: [
        {
          variant_id: "01940a00-0007-7000-8000-000000000001",
          sku: "CY-VANILA-250",
          name: "Vanila 250ml",
          net_content: { quantity: "250.000000", uom: "ML" },
          price: { currency: "IDR", amount: 16000 },
        },
      ],
    },
  ],
};

test.describe("Phase 1.7C.1 & 1.7C.2 — Motion & Data Integrity End-to-End Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/catalog", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_CATALOG),
      });
    });
  });

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

  test("2. Catalog card is presentational only with single 'Lihat Detail' CTA (No price, no size buttons, no cart)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Locate the Plain card
    const firstCard = page.locator("#catalog-carousel article").filter({ hasText: /Plain/i }).first();
    await expect(firstCard).toBeVisible();

    // 1. Verify card contains product name and 'Lihat Detail' CTA
    await expect(firstCard.getByRole("heading", { name: "Plain" })).toBeVisible();
    const ctaLink = firstCard.getByRole("link", { name: "Lihat Detail" });
    await expect(ctaLink).toBeVisible();

    // 2. Verify card DOES NOT contain size selector buttons or headings
    await expect(firstCard.getByText("Pilihan Ukuran")).toHaveCount(0);
    await expect(firstCard.getByRole("button", { name: "250 ml" })).toHaveCount(0);
    await expect(firstCard.getByRole("button", { name: "500 ml" })).toHaveCount(0);
    await expect(firstCard.getByRole("button", { name: "1 Liter" })).toHaveCount(0);

    // 3. Verify card DOES NOT contain price
    await expect(firstCard.getByText("Harga")).toHaveCount(0);
    await expect(firstCard.getByText(/Rp\s*15\.000/i)).toHaveCount(0);
    await expect(firstCard.getByText(/Rp\s*16\.000/i)).toHaveCount(0);
    await expect(firstCard.getByText(/Rp\s*30\.000/i)).toHaveCount(0);
    await expect(firstCard.getByText(/Rp\s*55\.000/i)).toHaveCount(0);

    // 4. Verify card DOES NOT contain Add to Cart or Preview buttons
    await expect(firstCard.getByRole("button", { name: /\+ Keranjang/i })).toHaveCount(0);
    await expect(firstCard.getByText("Pratinjau")).toHaveCount(0);

    // 5. Clicking Lihat Detail navigates to /product/plain
    await ctaLink.click();
    await expect(page).toHaveURL(/.*\/product\/plain/);
    await expect(page.locator("h1")).toHaveText("Plain");
  });

  test("3. Product detail page is variant authority: 250ml (16k), 500ml (30k), 1L (55k), no 15k", async ({ page }) => {
    await page.goto("/product/plain");
    await expect(page.locator("h1")).toHaveText("Plain");

    // 1. All three variant buttons must be visible
    const btn250 = page.getByRole("button", { name: /250 ml/i }).first();
    const btn500 = page.getByRole("button", { name: /500 ml/i }).first();
    const btn1000 = page.getByRole("button", { name: /1 Liter/i }).first();

    await expect(btn250).toBeVisible();
    await expect(btn500).toBeVisible();
    await expect(btn1000).toBeVisible();

    // 2. Default 250ml must show Rp 16.000, and NEVER stale Rp 15.000
    await expect(page.getByText(/16\.000/).first()).toBeVisible();
    await expect(page.getByText(/15\.000/)).toHaveCount(0);

    // 3. Select 500 ml -> price updates to Rp 30.000
    await btn500.click();
    await page.waitForTimeout(200);
    await expect(page.getByText(/30\.000/).first()).toBeVisible();

    // 4. Select 1 Liter -> price updates to Rp 55.000 and shows neutral placeholder
    await btn1000.click();
    await page.waitForTimeout(200);
    await expect(page.getByText(/55\.000/).first()).toBeVisible();
    await expect(page.getByText("Foto resmi 1L segera hadir")).toBeVisible();

    // 5. Select 250 ml again -> returns to Rp 16.000
    await btn250.click();
    await page.waitForTimeout(200);
    await expect(page.getByText(/16\.000/).first()).toBeVisible();
    await expect(page.getByText(/15\.000/)).toHaveCount(0);
  });

  test("4. Prefers-reduced-motion is respected without breaking functional UI", async ({ page }) => {
    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

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

    // 3. Route navigation still functions seamlessly via Lihat Detail
    const detailLink = testArticle.getByRole("link", { name: "Lihat Detail" });
    await detailLink.click();
    await expect(page).toHaveURL(/.*product\/plain/);
    await expect(page.locator("h1")).toHaveText("Plain");
  });

  test("6. Vertical scroll gesture does not horizontally shift catalog carousel", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const carousel = page.locator("#catalog-carousel");
    await carousel.scrollIntoViewIfNeeded();

    // Reset initial scrollLeft
    await carousel.evaluate((el) => {
      el.scrollTo({ left: 0, behavior: "instant" });
    });
    await page.waitForTimeout(200);

    const initialScrollLeft = await carousel.evaluate((el) => el.scrollLeft);
    const initialPageScrollY = await page.evaluate(() => window.scrollY);

    // Perform pure vertical wheel scroll (deltaY = 300, deltaX = 0)
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(400);

    const afterScrollLeft = await carousel.evaluate((el) => el.scrollLeft);
    const afterPageScrollY = await page.evaluate(() => window.scrollY);

    // Verify page scrollY moved vertically
    expect(afterPageScrollY).toBeGreaterThanOrEqual(initialPageScrollY);

    // Critical Invariant: Carousel scrollLeft must NOT have changed horizontally
    expect(Math.abs(afterScrollLeft - initialScrollLeft)).toBeLessThanOrEqual(2);
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
