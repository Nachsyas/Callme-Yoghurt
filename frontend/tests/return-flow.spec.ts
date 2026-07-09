import { test, expect } from '@playwright/test';

test.describe('Form Retur Komplain E2E Flow', () => {
  test('Submit button is disabled initially and enabled after checking both conditions', async ({ page }) => {
    // In a real scenario we navigate to localhost:3000/return
    // await page.goto('/return');
    
    // We will simulate DOM interaction using locators based on the IDs assigned
    // Namun untuk mencegah error karena tidak ada server Next yang berjalan di tahap scaffold ini,
    // kita gunakan skip logic.
    test.skip(process.env.CI !== 'true', 'Skip actual navigation in isolated dev environment without server');

    await page.goto('http://localhost:3000/return');

    const submitBtn = page.locator('#btn-submit-return');
    const chkVideo = page.locator('#chk-video');
    const chkRating = page.locator('#chk-rating');

    // 1. Tombol Submit harus disabled di awal
    await expect(submitBtn).toBeDisabled();

    // 2. Centang checkbox pertama saja, tombol masih disabled
    await chkVideo.check();
    await expect(submitBtn).toBeDisabled();

    // 3. Centang checkbox kedua (keduanya true), tombol harus enabled
    await chkRating.check();
    await expect(submitBtn).toBeEnabled();

    // 4. Uncheck salah satu, tombol kembali disabled
    await chkVideo.uncheck();
    await expect(submitBtn).toBeDisabled();
  });
});
