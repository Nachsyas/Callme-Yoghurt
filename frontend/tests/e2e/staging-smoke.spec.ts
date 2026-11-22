import { test, expect } from "@playwright/test";

/**
 * Callme Yoghurt — Vercel Staging Deployment Smoke Test Suite (Phase 1.2D)
 *
 * Verifies that the deployed web application maintains functional and security boundaries:
 * 1. Storefront homepage loads (200).
 * 2. Product detail page loads (200).
 * 3. Admin route protection works (unauthenticated callers redirected).
 * 4. Admin login page loads (200).
 * 5. API error sanitization works (zero upstream ERP credential/URL leakage).
 */

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

test.describe("Vercel Staging Deployment Smoke Tests (Phase 1.2D)", () => {
  // Test 1: Storefront homepage loads
  test("1. Storefront homepage loads successfully with branding and catalog", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    // Verify brand typography and primary sections
    await expect(page).toHaveTitle(/Callme Yoghurt/i);
    await expect(page.getByText("Varian Rasa Pilihan.")).toBeVisible();
    await expect(page.locator("#kisah").getByText("Kisah Kami")).toBeVisible();
    await expect(page.getByText("Callme Yoghurt Cipayung")).toBeVisible();

    // Verify cart link exists
    const cartButton = page.locator('a[href="/checkout"]').first();
    await expect(cartButton).toBeVisible();
  });

  // Test 2: Product page loads
  test("2. Product page loads successfully with Cold Chain storage guidance", async ({ page }) => {
    // Intercept catalog API only if running in local test mode without live ERP
    if (!process.env.STAGING_URL) {
      await page.route("**/api/catalog", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_CATALOG),
        });
      });
    }

    const response = await page.goto("/product/plain");
    expect(response?.status()).toBe(200);

    // Verify product name and purchase action
    await expect(page.getByText("Plain Pure Original")).toBeVisible();
    const addToCartBtn = page.getByRole("button", { name: /Tambahkan ke Pesanan/i });
    await expect(addToCartBtn).toBeVisible();
    await expect(addToCartBtn).toBeEnabled();

    // Verify Cold Chain storage specifications per enterprise SOP
    await expect(page.getByText("Instruksi Penyimpanan")).toBeVisible();
    await expect(page.getByText(/Hanya tahan 3 hari di suhu ruang/i)).toBeVisible();
  });

  // Test 3: Admin route protection works
  test("3. Admin route protection prevents unauthenticated access to operations dashboard", async ({ page }) => {
    // Attempt accessing privileged admin dashboard directly
    await page.goto("/admin");

    // Must be redirected either to /admin/login (in admin mode) or / (in storefront mode)
    const currentUrl = page.url();
    const isRedirectedToLogin = currentUrl.includes("/admin/login");
    const isRedirectedToHome = currentUrl.endsWith("/") || currentUrl.includes("/?");

    expect(isRedirectedToLogin || isRedirectedToHome).toBe(true);

    // Privileged dashboard content must NEVER be exposed
    await expect(page.getByText("Authenticated Session Active")).not.toBeVisible();
    await expect(page.getByText("Authoritative Catalog")).not.toBeVisible();
  });

  // Test 4: Login page loads
  test("4. Admin login page loads with proper authentication controls", async ({ page }) => {
    const response = await page.goto("/admin/login");
    expect(response?.status()).toBe(200);

    // Verify portal branding
    await expect(page.getByText("Callme Yoghurt Operations")).toBeVisible();
    await expect(page.getByText("Privileged Administrative Portal")).toBeVisible();

    // Verify credentials form inputs
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toHaveText(/Sign In to Operations/i);
  });

  // Test 5: API error sanitization works
  test("5. API error sanitization prevents internal ERP network and token leakage", async ({ request }) => {
    // Test BFF error sanitization on unreachable upstream
    const catalogResponse = await request.get("/api/catalog");
    if (!catalogResponse.ok()) {
      expect([500, 502, 503]).toContain(catalogResponse.status());
      const bodyText = await catalogResponse.text();
      // SECURITY INVARIANTS: Zero secret leakage in response body
      expect(bodyText).not.toContain("localhost:8000");
      expect(bodyText).not.toContain("127.0.0.1:8000");
      expect(bodyText).not.toContain("ERP_SERVICE_TOKEN");
      expect(bodyText).not.toContain("Bearer");
    }

    // Test Admin login BFF sanitization on invalid credentials or unreachable upstream
    const loginResponse = await request.post("/api/admin/login", {
      data: {
        email: "test.admin@callmeyoghurt.com",
        password: "invalid-password",
      },
    });

    // Must be either 401 Unauthorized (if upstream ERP is up) or 502 Unavailable (if upstream is down)
    expect([401, 502]).toContain(loginResponse.status());
    const loginBodyText = await loginResponse.text();
    expect(loginBodyText).not.toContain("localhost:8000");
    expect(loginBodyText).not.toContain("127.0.0.1:8000");
    expect(loginBodyText).not.toContain("ADMIN_SESSION_SECRET");
  });
});
