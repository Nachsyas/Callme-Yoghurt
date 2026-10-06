import { chromium } from '@playwright/test';
import * as path from 'path';

const ARTIFACTS_DIR = '/Users/user/.gemini/antigravity-ide/brain/84493374-de71-4ba1-9395-94d6aa88099c';
const BASE_URL = 'https://callme-yoghurt-storefront.vercel.app';

async function capture() {
  console.log('Launching browser to capture production screenshots from:', BASE_URL);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  try {
    // 1. Homepage
    console.log('1. Capturing production-homepage.png...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'production-homepage.png'),
      fullPage: true,
    });

    // 2. Product Detail Page
    console.log('2. Capturing production-product-detail.png...');
    await page.goto(`${BASE_URL}/product/plain`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'production-product-detail.png'),
      fullPage: true,
    });

    // 3. Product Variants
    console.log('3. Capturing production-product-variants.png...');
    const btn500 = page.getByRole('button', { name: /500\s*ml/i });
    if (await btn500.isVisible()) {
      await btn500.click();
    }
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'production-product-variants.png'),
      fullPage: false,
    });

    // 4. Cart Drawer
    console.log('4. Capturing production-cart.png...');
    const addToCartBtn = page.getByRole('button', { name: /(Tambah ke Keranjang|Tambahkan ke Pesanan)/i });
    if (await addToCartBtn.isVisible()) {
      await addToCartBtn.click();
    }
    await page.waitForTimeout(800);
    const drawer = page.locator('#cart-drawer');
    if (await drawer.isVisible()) {
      await drawer.screenshot({
        path: path.join(ARTIFACTS_DIR, 'production-cart.png'),
      });
    } else {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'production-cart.png'),
        fullPage: true,
      });
    }

    // 5. Checkout Page
    console.log('5. Capturing production-checkout.png...');
    const checkoutCTA = page.getByRole('link', { name: /Lanjut ke Checkout/i });
    if (await checkoutCTA.isVisible()) {
      await checkoutCTA.click();
      await page.waitForURL('**/checkout');
    } else {
      await page.goto(`${BASE_URL}/checkout`, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'production-checkout.png'),
      fullPage: true,
    });

    // 6. Shipping Destination Form
    console.log('6. Capturing production-shipping-destination.png...');
    await page.locator('input[name="name"]').fill('Budi Santoso');
    await page.locator('input[name="whatsapp"]').fill('081234567890');
    await page.locator('textarea[name="address"]').fill('Jl. Bambu Apus No. 12, RT 02/RW 05, Cipayung');
    await page.locator('input[name="province"]').fill('DKI Jakarta');
    await page.locator('input[name="city"]').fill('Jakarta Timur');
    await page.locator('input[name="district"]').fill('Cipayung');
    await page.locator('input[name="postalCode"]').fill('13890');
    await page.waitForTimeout(500);

    const destinationSection = page.locator('#checkout-form');
    if (await destinationSection.isVisible()) {
      await destinationSection.screenshot({
        path: path.join(ARTIFACTS_DIR, 'production-shipping-destination.png'),
      });
    } else {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'production-shipping-destination.png'),
      });
    }

    // 7. Shipping Rates / Quotes Section
    console.log('7. Capturing production-shipping-quotes.png...');
    const hitungBtn = page.getByRole('button', { name: /Hitung Ongkir Resmi/i });
    if (await hitungBtn.isVisible()) {
      await hitungBtn.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'production-shipping-quotes.png'),
      fullPage: false,
    });

    // 8. Service Fee Section
    console.log('8. Capturing production-service-fee.png...');
    const summaryCard = page.locator('.lg\\:col-span-5');
    if (await summaryCard.isVisible()) {
      await summaryCard.screenshot({
        path: path.join(ARTIFACTS_DIR, 'production-service-fee.png'),
      });
    } else {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'production-service-fee.png'),
      });
    }

    // 9. Order Summary
    console.log('9. Capturing production-order-summary.png...');
    if (await summaryCard.isVisible()) {
      await summaryCard.screenshot({
        path: path.join(ARTIFACTS_DIR, 'production-order-summary.png'),
      });
    } else {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'production-order-summary.png'),
        fullPage: true,
      });
    }

    // 10. Payment State
    console.log('10. Capturing production-payment-state.png...');
    const paymentSection = page.locator('#checkout-form');
    if (await paymentSection.isVisible()) {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'production-payment-state.png'),
        fullPage: true,
      });
    } else {
      await page.screenshot({
        path: path.join(ARTIFACTS_DIR, 'production-payment-state.png'),
      });
    }

    console.log('All 10 production screenshots captured successfully in:', ARTIFACTS_DIR);
  } catch (err) {
    console.error('Error capturing production screenshots:', err);
  } finally {
    await browser.close();
  }
}

capture();
