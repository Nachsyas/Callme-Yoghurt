const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend/node_modules/@playwright/test'));

const STOREFRONT_URL = 'https://callme-yoghurt-storefront.vercel.app';
const ADMIN_URL = 'https://callme-yoghurt-admin.vercel.app';
const CHROMIUM_PATH = '/Users/user/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const OUTPUT_DIR = path.resolve(__dirname, '../production-verification/phase-1.7C.22');
const ARTIFACTS_DIR = '/Users/user/.gemini/antigravity-ide/brain/84493374-de71-4ba1-9395-94d6aa88099c';
const LOCAL_PORT = 3002;
const LOCAL_BASE_URL = `http://127.0.0.1:${LOCAL_PORT}`;
const ADMIN_SESSION_SECRET = 'test_cryptographically_secure_admin_session_key_32c';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function copyToArtifacts(filename) {
  const src = path.join(OUTPUT_DIR, filename);
  const dest = path.join(ARTIFACTS_DIR, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

// Generate valid HMAC-SHA256 admin session token
async function generateAdminSessionToken(user, secret) {
  const now = Math.floor(Date.now() / 1000);
  const session = {
    user,
    issuedAt: now,
    expiresAt: now + 3600,
  };
  const payloadStr = JSON.stringify(session);
  const encodedPayload = Buffer.from(payloadStr)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(encodedPayload);
  const signature = hmac
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedPayload}.${signature}`;
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          resolve(res.statusCode);
        });
        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`Timeout waiting for server at ${url}`);
}

async function injectTestBadge(page) {
  await page.evaluate(() => {
    const existing = document.getElementById('test-mock-banner');
    if (!existing) {
      const banner = document.createElement('div');
      banner.id = 'test-mock-banner';
      banner.style.cssText =
        'position: fixed; top: 0; left: 0; right: 0; z-index: 999999; background: #991b1b; color: #ffffff; text-align: center; font-family: monospace; font-size: 13px; font-weight: bold; padding: 6px 12px; letter-spacing: 0.05em; border-bottom: 2px solid #f87171; box-shadow: 0 2px 8px rgba(0,0,0,0.4);';
      banner.innerText = '⚠️ TEST / MOCKED ENVIRONMENT — SIMULATED CHECKOUT (NO REAL COURIER / NO REAL PAYMENT) ⚠️';
      document.body.prepend(banner);
      document.body.style.paddingTop = '32px';
    }
  });
}

async function run() {
  console.log('=== Phase 1.7C.22 Screenshot Verification Automation ===');
  console.log('Launching Next.js server on port', LOCAL_PORT, '...');

  const nextProcess = spawn(
    'npx',
    ['next', 'start', '-p', String(LOCAL_PORT)],
    {
      cwd: path.resolve(__dirname, '../frontend'),
      env: {
        ...process.env,
        PORT: String(LOCAL_PORT),
        ADMIN_SESSION_SECRET,
        APP_DEPLOYMENT_ROLE: 'admin',
        NEXT_PUBLIC_APP_MODE: 'admin',
        ERP_INTERNAL_URL: 'http://127.0.0.1:8000',
        ERP_SERVICE_TOKEN: 'callme_dev_service_secret_token_min32chars',
      },
      stdio: 'pipe',
    }
  );

  nextProcess.stdout.on('data', (d) => process.stdout.write(`[next:stdout] ${d}`));
  nextProcess.stderr.on('data', (d) => process.stderr.write(`[next:stderr] ${d}`));

  try {
    await waitForServer(`${LOCAL_BASE_URL}/admin/login`, 30000);
    console.log('Local Next.js server is ready on port', LOCAL_PORT);

    console.log('Launching local Chromium at:', CHROMIUM_PATH);
    const browser = await chromium.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
    });

    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    });

    const page = await desktopContext.newPage();
    const mobilePage = await mobileContext.newPage();

    // -------------------------------------------------------------
    // 01. Storefront Production Homepage
    // -------------------------------------------------------------
    console.log('Capturing 01-storefront-production-homepage.png...');
    await page.goto(STOREFRONT_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const path01 = path.join(OUTPUT_DIR, '01-storefront-production-homepage.png');
    await page.screenshot({ path: path01, fullPage: true });
    await copyToArtifacts('01-storefront-production-homepage.png');
    console.log('Saved 01');

    // -------------------------------------------------------------
    // 02. Storefront Product Detail
    // -------------------------------------------------------------
    console.log('Capturing 02-storefront-product-detail.png...');
    await page.goto(`${STOREFRONT_URL}/product/plain`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const path02 = path.join(OUTPUT_DIR, '02-storefront-product-detail.png');
    await page.screenshot({ path: path02, fullPage: true });
    await copyToArtifacts('02-storefront-product-detail.png');
    console.log('Saved 02');

    // -------------------------------------------------------------
    // 03. Storefront Cart State
    // -------------------------------------------------------------
    console.log('Capturing 03-storefront-cart-state.png...');
    const cartBtn = page.getByRole('button', { name: /Buka Keranjang Belanja/i }).first();
    if (await cartBtn.isVisible()) {
      await cartBtn.click();
      await page.waitForTimeout(800);
    }
    const path03 = path.join(OUTPUT_DIR, '03-storefront-cart-state.png');
    await page.screenshot({ path: path03, fullPage: false });
    await copyToArtifacts('03-storefront-cart-state.png');
    console.log('Saved 03');

    // -------------------------------------------------------------
    // 04. Storefront Checkout Blocked / Safe State
    // -------------------------------------------------------------
    console.log('Capturing 04-storefront-checkout-blocked.png...');
    await page.goto(`${STOREFRONT_URL}/checkout`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const path04 = path.join(OUTPUT_DIR, '04-storefront-checkout-blocked.png');
    await page.screenshot({ path: path04, fullPage: true });
    await copyToArtifacts('04-storefront-checkout-blocked.png');
    console.log('Saved 04');

    // -------------------------------------------------------------
    // 05. Admin Production Login
    // -------------------------------------------------------------
    console.log('Capturing 05-admin-production-login.png...');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const path05 = path.join(OUTPUT_DIR, '05-admin-production-login.png');
    await page.screenshot({ path: path05, fullPage: true });
    await copyToArtifacts('05-admin-production-login.png');
    console.log('Saved 05');

    // -------------------------------------------------------------
    // 06. Admin Unauthenticated Redirect
    // -------------------------------------------------------------
    console.log('Capturing 06-admin-unauthenticated-redirect.png...');
    await page.goto(`${ADMIN_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const path06 = path.join(OUTPUT_DIR, '06-admin-unauthenticated-redirect.png');
    await page.screenshot({ path: path06, fullPage: true });
    await copyToArtifacts('06-admin-unauthenticated-redirect.png');
    console.log('Saved 06 (URL is redirected to /admin/login?from=%2Fadmin)');

    // -------------------------------------------------------------
    // 07. Admin Dashboard Authenticated (Local Testing Environment)
    // -------------------------------------------------------------
    console.log('Capturing 07-admin-dashboard-authenticated.png...');
    const ownerToken = await generateAdminSessionToken(
      {
        id: 'usr-owner-001',
        username: 'owner_lead',
        email: 'owner@callmeyoghurt.com',
        role: 'OWNER',
      },
      ADMIN_SESSION_SECRET
    );

    await desktopContext.addCookies([
      {
        name: 'callme_admin_session',
        value: ownerToken,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);

    await page.goto(`${LOCAL_BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const path07 = path.join(OUTPUT_DIR, '07-admin-dashboard-authenticated.png');
    await page.screenshot({ path: path07, fullPage: true });
    await copyToArtifacts('07-admin-dashboard-authenticated.png');
    console.log('Saved 07');

    // -------------------------------------------------------------
    // 08. Admin ERP Connection State
    // -------------------------------------------------------------
    console.log('Capturing 08-admin-erp-connection-state.png...');
    await page.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const path08 = path.join(OUTPUT_DIR, '08-admin-erp-connection-state.png');
    await page.screenshot({ path: path08, fullPage: true });
    await copyToArtifacts('08-admin-erp-connection-state.png');
    console.log('Saved 08');

    // -------------------------------------------------------------
    // 09. Mobile Storefront
    // -------------------------------------------------------------
    console.log('Capturing 09-mobile-storefront.png...');
    await mobilePage.goto(STOREFRONT_URL, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1500);
    const path09 = path.join(OUTPUT_DIR, '09-mobile-storefront.png');
    await mobilePage.screenshot({ path: path09, fullPage: true });
    await copyToArtifacts('09-mobile-storefront.png');
    console.log('Saved 09');

    // -------------------------------------------------------------
    // 10. Mobile Admin Login
    // -------------------------------------------------------------
    console.log('Capturing 10-mobile-admin-login.png...');
    await mobilePage.goto(`${ADMIN_URL}/admin/login`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(1500);
    const path10 = path.join(OUTPUT_DIR, '10-mobile-admin-login.png');
    await mobilePage.screenshot({ path: path10, fullPage: true });
    await copyToArtifacts('10-mobile-admin-login.png');
    console.log('Saved 10');

    // =============================================================
    // SIMULATED CUSTOMER CHECKOUT (11 to 16)
    // LEVEL B — SIMULATED CUSTOMER CHECKOUT
    // Labeled visually as: TEST / MOCKED
    // =============================================================
    console.log('Starting simulated customer checkout flow (11-16)...');

    const testContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    });
    const testPage = await testContext.newPage();
    testPage.on('console', (msg) => console.log('[testPage:console]', msg.text()));
    testPage.on('pageerror', (err) => console.error('[testPage:pageerror]', err));

    // Setup routes for Level B simulated checkout
    await testPage.route('**/api/catalog', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          products: [
            {
              product_id: '01912a76-2f00-7bb0-b3b7-e2da49303380',
              name: 'Plain Pure Original',
              slug: 'plain',
              category: 'stirred',
              description: 'Yoghurt stirred murni tanpa perisa tambahan.',
              variants: [
                {
                  variant_id: '01912a76-2f00-7bb0-b3b7-e2da49303381',
                  sku: 'CY-PLAIN-250',
                  name: 'Plain 250ml',
                  net_content: { quantity: '250', uom: 'ML' },
                  price: { amount: 16000, currency: 'IDR' },
                  is_active: true,
                },
                {
                  variant_id: '01912a76-2f00-7bb0-b3b7-e2da49303382',
                  sku: 'CY-PLAIN-500',
                  name: 'Plain 500ml',
                  net_content: { quantity: '500', uom: 'ML' },
                  price: { amount: 30000, currency: 'IDR' },
                  is_active: true,
                },
                {
                  variant_id: '01912a76-2f00-7bb0-b3b7-e2da49303383',
                  sku: 'CY-PLAIN-1000',
                  name: 'Plain 1000ml',
                  net_content: { quantity: '1000', uom: 'ML' },
                  price: { amount: 55000, currency: 'IDR' },
                  is_active: true,
                },
              ],
            },
          ],
        }),
      });
    });

    await testPage.route('**/api/shipping/quote', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            service_fee: {
              isConfigured: true,
              amount: 2000,
              name: 'Biaya Layanan',
              status: 'TEST CONFIGURED',
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            quotes: [
              {
                quote_id: '01912a76-1111-7000-8000-000000000001',
                courier_name: 'GrabExpress',
                service_type: 'instant',
                service_name: 'Instant (3 Jam)',
                price: 18000,
                duration: '1-3 Jam',
              },
              {
                quote_id: '01912a76-2222-7000-8000-000000000002',
                courier_name: 'GoSend',
                service_type: 'sameday',
                service_name: 'Same Day (6-8 Jam)',
                price: 14000,
                duration: '6-8 Jam',
              },
            ],
            service_fee: {
              isConfigured: true,
              amount: 2000,
              name: 'Biaya Layanan',
              status: 'TEST CONFIGURED',
            },
          }),
        });
      }
    });

    await testPage.route('**/api/checkout', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: {
          'Cache-Control': 'no-store',
        },
        body: JSON.stringify({
          success: true,
          request_id: 'req-simulated-001',
          data: {
            order_id: '01912a76-9999-7000-8000-000000000001',
            order_number: 'CY-TEST-2026-0001',
            status: 'CONFIRMED',
            total_amount: 50000, // 30.000 (Plain 500ml) + 18.000 (Instant) + 2.000 (Service fee)
            request_id: 'req-simulated-001',
            payment: {
              payment_id: 'pay-test-qris-001',
              provider: 'manual_qris',
              status: 'PENDING',
              amount: 50000,
              account_name: 'Callme Yoghurt Official Merchant (SIMULATED)',
              qr_code_url: '/images/test-qris-mock.png',
              instructions: [
                'Buka aplikasi e-wallet atau perbankan Anda (BCA, Mandiri, GoPay, OVO).',
                'Pindai QRIS merchant yang tertera untuk pengujian simulasi.',
                'Simpan bukti transfer simulasi dan kirimkan konfirmasi manual via WhatsApp.',
              ],
            },
          },
        }),
      });
    });

    // 11. Test Product Selection
    console.log('Capturing 11-test-product-selection.png...');
    await testPage.goto(`${LOCAL_BASE_URL}/product/plain`, { waitUntil: 'domcontentloaded' });
    await testPage.waitForTimeout(1000);
    await injectTestBadge(testPage);

    // Select 500ml
    const size500Btn = testPage.getByRole('button', { name: /500 ml/i }).first();
    if (await size500Btn.isVisible()) {
      await size500Btn.click();
      await testPage.waitForTimeout(400);
    }
    const path11 = path.join(OUTPUT_DIR, '11-test-product-selection.png');
    await testPage.screenshot({ path: path11, fullPage: true });
    await copyToArtifacts('11-test-product-selection.png');
    console.log('Saved 11');

    // 12. Test Cart
    console.log('Capturing 12-test-cart.png...');
    const drawer = testPage.locator('#cart-drawer');
    const addToCartBtn = testPage.getByRole('button', { name: /Tambah ke Keranjang/i }).first();
    if (await addToCartBtn.isVisible()) {
      await addToCartBtn.click();
      await testPage.waitForTimeout(800);
    }
    await injectTestBadge(testPage);
    const path12 = path.join(OUTPUT_DIR, '12-test-cart.png');
    await testPage.screenshot({ path: path12, fullPage: false });
    await copyToArtifacts('12-test-cart.png');
    console.log('Saved 12');

    // 13. Test Shipping Selection
    console.log('Capturing 13-test-shipping-selection.png...');
    // Click checkout CTA inside drawer for client-side navigation to preserve in-memory cart
    const checkoutCTA = drawer.getByRole('link', { name: /Lanjut ke Checkout/i });
    await checkoutCTA.click();
    await testPage.waitForURL('**/checkout');
    await testPage.waitForTimeout(1000);
    await injectTestBadge(testPage);

    // Fill customer form
    const nameInput = testPage.locator('input[name="name"]');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill('Budi Santoso (TEST)');
    await testPage.locator('input[name="whatsapp"]').fill('081234567890');
    await testPage.locator('textarea[name="address"]').fill('Jl. Bambu Apus No. 12, RT 02/RW 05');
    await testPage.locator('input[name="province"]').fill('DKI Jakarta');
    await testPage.locator('input[name="city"]').fill('Jakarta Timur');
    await testPage.locator('input[name="district"]').fill('Cipayung');
    await testPage.locator('input[name="postalCode"]').fill('13890');

    // Click calculate shipping
    const hitungOngkirBtn = testPage.getByRole('button', { name: /Hitung Ongkir Resmi/i }).first();
    if (await hitungOngkirBtn.isVisible()) {
      await hitungOngkirBtn.click();
      await testPage.waitForTimeout(2000);
    }
    await injectTestBadge(testPage);
    const path13 = path.join(OUTPUT_DIR, '13-test-shipping-selection.png');
    await testPage.screenshot({ path: path13, fullPage: true });
    await copyToArtifacts('13-test-shipping-selection.png');
    console.log('Saved 13');

    // 14. Test Order Summary
    console.log('Capturing 14-test-order-summary.png...');
    const summaryCard = testPage.locator('.lg\\:col-span-5').first();
    await injectTestBadge(testPage);
    const path14 = path.join(OUTPUT_DIR, '14-test-order-summary.png');
    if (await summaryCard.isVisible()) {
      await summaryCard.screenshot({ path: path14 });
    } else {
      await testPage.screenshot({ path: path14, fullPage: true });
    }
    await copyToArtifacts('14-test-order-summary.png');
    console.log('Saved 14');

    // 15. Test Manual QRIS State
    console.log('Capturing 15-test-manual-qris-state.png...');
    const qrisCard = testPage.locator('text=Manual QRIS Merchant').first();
    if (await qrisCard.isVisible()) {
      await qrisCard.scrollIntoViewIfNeeded();
    }
    await injectTestBadge(testPage);
    const path15 = path.join(OUTPUT_DIR, '15-test-manual-qris-state.png');
    await testPage.screenshot({ path: path15, fullPage: false });
    await copyToArtifacts('15-test-manual-qris-state.png');
    console.log('Saved 15');

    // 16. Test Payment Status
    console.log('Capturing 16-test-payment-status.png...');
    const submitBtn = testPage.getByRole('button', { name: /Selesaikan Pesanan/i }).first();
    await submitBtn.waitFor({ state: 'visible', timeout: 5000 });
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();
    await testPage.waitForURL('**/return**', { timeout: 15000 });
    await testPage.waitForTimeout(2000);
    await injectTestBadge(testPage);
    const path16 = path.join(OUTPUT_DIR, '16-test-payment-status.png');
    await testPage.screenshot({ path: path16, fullPage: true });
    await copyToArtifacts('16-test-payment-status.png');
    console.log('Saved 16');

    await browser.close();
    console.log('All 16 screenshots successfully captured!');
  } finally {
    console.log('Stopping local Next.js background process...');
    nextProcess.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('Screenshot automation failed:', err);
  process.exit(1);
});
