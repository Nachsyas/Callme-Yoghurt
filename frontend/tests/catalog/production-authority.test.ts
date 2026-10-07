import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { useCartStore, isLegacyPreviewVariantId, type CartItem } from '../../src/store/cartStore.ts';

describe('Phase 1.7C.20 — Production Authority & Preview Safety Invariants', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart();
  });

  // 1. Fabricated preview variant cannot enter transactional cart
  it('1. proves fabricated preview variant cannot enter transactional cart', () => {
    const previewItem: CartItem = {
      variant_id: '01940a00-1111-2222-3333-444444444444',
      sku: 'CMY-STR-250-PREVIEW',
      name: 'Callme Yoghurt Stroberi 250ml (Preview)',
      quantity: 1,
      display_price: 20000,
      volume_ml: 250,
    };

    useCartStore.getState().addItem(previewItem);

    assert.equal(
      useCartStore.getState().items.length,
      0,
      'Fabricated preview item must be blocked from entering cart',
    );
  });

  // 2. ERP-offline PDP remains browseable but Add to Cart is transaction-disabled
  it('2. proves ERP-offline PDP remains browseable but Add to Cart is transaction-disabled', () => {
    const pdpSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/product/[id]/page.tsx'),
      'utf-8',
    );

    assert.match(
      pdpSource,
      /catalogOnline && Boolean\(currentErpVariant\)/,
      'PDP must require catalogOnline and valid ERP variant for Add to Cart',
    );
    assert.match(
      pdpSource,
      /Katalog transaksi sedang tidak tersedia\. Produk tetap dapat dilihat, tetapi belum dapat ditambahkan ke pesanan\./,
      'PDP must show safe offline notice instead of marking variant inactive',
    );
    assert.doesNotMatch(
      pdpSource,
      /getFallbackVariant/,
      'PDP must not contain getFallbackVariant function',
    );
  });

  // 3. Payment unavailable does not mark real ERP variant inactive
  it('3. proves payment unavailable does not mark real ERP variant inactive', () => {
    const catalogSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/api/catalog/route.ts'),
      'utf-8',
    );

    // Catalog variants reflect ERP product state, independent of payment gateway status
    assert.doesNotMatch(
      catalogSource,
      /PAYMENT_AVAILABLE === false.*inactive/i,
      'Catalog variants must not be marked inactive due to payment gateway status',
    );
  });

  // 4. Real ERP variant can still enter cart
  it('4. proves real ERP variant can still enter cart', () => {
    const realItem: CartItem = {
      variant_id: '018f3a20-0000-7000-8000-000000000001',
      sku: 'CMY-STR-250',
      name: 'Callme Yoghurt Stroberi 250ml',
      quantity: 2,
      display_price: 20000,
      volume_ml: 250,
    };

    assert.equal(isLegacyPreviewVariantId(realItem.variant_id), false);
    useCartStore.getState().addItem(realItem);

    assert.equal(useCartStore.getState().items.length, 1);
    assert.equal(useCartStore.getState().items[0]?.variant_id, '018f3a20-0000-7000-8000-000000000001');
    assert.equal(useCartStore.getState().items[0]?.quantity, 2);
  });

  // 5. Stale legacy preview cart entry cannot checkout
  it('5. proves stale legacy preview cart entry is purged and cannot checkout', () => {
    // If a preview item somehow got into state, purgeLegacyPreviewItems removes it
    useCartStore.setState({
      items: [
        {
          variant_id: '01940a00-dead-beef-0000-000000000001',
          sku: 'OLD-PREVIEW-SKU',
          name: 'Stale Preview Item',
          quantity: 1,
          display_price: 15000,
        },
      ],
    });

    assert.equal(useCartStore.getState().items.length, 1);
    useCartStore.getState().purgeLegacyPreviewItems();
    assert.equal(useCartStore.getState().items.length, 0, 'Legacy preview item must be purged');

    const checkoutSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/checkout/page.tsx'),
      'utf-8',
    );
    assert.match(
      checkoutSource,
      /isLegacyPreviewVariantId\(i\.variant_id\)/,
      'Checkout page must detect and reject legacy preview variants',
    );
  });

  // 6. Numeric "Total Pembayaran" is not shown as final before quote
  it('6. proves numeric Total Pembayaran is not shown as final before quote', () => {
    const checkoutSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/checkout/page.tsx'),
      'utf-8',
    );

    assert.match(
      checkoutSource,
      /selectedQuote && serviceFeeConfig\?\.isConfigured.*Belum final/s,
      'Checkout page must display "Belum final" before authoritative shipping quote',
    );
    assert.match(
      checkoutSource,
      /selectedQuote\s*\?\s*`Rp \$\{shippingFee\.toLocaleString\('id-ID'\)\}`\s*:\s*'Belum dihitung'/,
      'Ongkir must show "Belum dihitung" prior to quote',
    );
  });

  // 7. Authoritative payable_total shown after ERP quote
  it('7. proves authoritative payable_total shown after ERP quote', () => {
    const checkoutSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/checkout/page.tsx'),
      'utf-8',
    );

    assert.match(
      checkoutSource,
      /selectedQuote\?\.payable_total/,
      'Checkout page must use selectedQuote.payable_total for final total',
    );
  });

  // 8. No "0–5°C Cold Chain" transit guarantee in customer-facing UI
  it('8. proves no "0–5°C Cold Chain" transit guarantee in customer-facing UI', () => {
    const filesToAudit = [
      'src/app/page.tsx',
      'src/components/catalog/CatalogCard.tsx',
      'src/app/product/[id]/page.tsx',
      'src/app/checkout/page.tsx',
      'src/app/return/page.tsx',
      'src/lib/order/receipt-service.ts',
    ];

    for (const relPath of filesToAudit) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      assert.doesNotMatch(
        content,
        /0–5°C\s*Cold\s*Chain/i,
        `File ${relPath} must not contain "0–5°C Cold Chain"`,
      );
      assert.doesNotMatch(
        content,
        /Cold\s*Chain\s*Standard\s*\(0–5°C\)/i,
        `File ${relPath} must not contain "Cold Chain Standard (0–5°C)"`,
      );
      assert.doesNotMatch(
        content,
        /pengiriman\s*rantai\s*dingin\s*0–5°C/i,
        `File ${relPath} must not contain "pengiriman rantai dingin 0–5°C"`,
      );
      assert.doesNotMatch(
        content,
        /penjagaan\s*suhu\s*0–5°C/i,
        `File ${relPath} must not contain "penjagaan suhu 0–5°C"`,
      );
    }
  });

  // 9. Storage warning <5°C remains
  it('9. proves storage warning <5°C remains verbatim from SOP', () => {
    const pdpSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/product/[id]/page.tsx'),
      'utf-8',
    );
    const checkoutSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/checkout/page.tsx'),
      'utf-8',
    );

    assert.match(
      pdpSource,
      /Hanya tahan 3 hari di suhu ruang\. Langsung segera masukan kulkas begitu barang diterima \(Suhu (<|&lt;) 5°C\)/,
      'PDP must retain exact SOP storage warning',
    );
    assert.match(
      checkoutSource,
      /Hanya tahan 3 hari di suhu ruang\. Langsung segera masukan kulkas begitu barang diterima \(Suhu (<|&lt;) 5°C\)/,
      'Checkout must retain exact SOP storage warning',
    );
  });

  // 10. No misleading "QRIS 0% Fee" label
  it('10. proves no misleading "QRIS 0% Fee" label', () => {
    const checkoutSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/checkout/page.tsx'),
      'utf-8',
    );

    assert.doesNotMatch(
      checkoutSource,
      /0%\s*Fee/i,
      'Checkout must not display "0% Fee" label on QRIS',
    );
    assert.match(
      checkoutSource,
      /QRIS\s*Manual/,
      'Checkout must label payment method neutrally as QRIS Manual',
    );
    assert.match(
      checkoutSource,
      /QRIS — Scan untuk Membayar/,
      'Checkout must use neutral QRIS — Scan untuk Membayar label',
    );
  });

  // 11. Checkout BFF remains fail-closed when ERP unavailable
  it('11. proves checkout BFF remains fail-closed when ERP unavailable', () => {
    const checkoutBffSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/api/checkout/route.ts'),
      'utf-8',
    );

    assert.match(
      checkoutBffSource,
      /if \(!erpBaseUrl \|\| !erpServiceToken\) \{/s,
      'Checkout BFF must fail closed when ERP config is incomplete',
    );
    assert.match(
      checkoutBffSource,
      /status:\s*503/,
      'Checkout BFF must return 503 on missing config',
    );
  });

  // 12. Admin GET orders no longer reads adminOrderStore
  it('12. proves admin GET orders no longer reads adminOrderStore in production route', () => {
    const adminOrdersRoute = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/api/admin/orders/route.ts'),
      'utf-8',
    );
    const adminOrderDetailRoute = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/api/admin/orders/[id]/route.ts'),
      'utf-8',
    );

    assert.doesNotMatch(
      adminOrdersRoute,
      /adminOrderStore/,
      'Admin orders route must not import or use adminOrderStore',
    );
    assert.doesNotMatch(
      adminOrderDetailRoute,
      /adminOrderStore/,
      'Admin order detail route must not import or use adminOrderStore',
    );
  });

  // 13. Admin order list comes from Laravel/PostgreSQL contract
  it('13. proves admin order list forwards to Laravel ERP internal endpoint', () => {
    const adminOrdersRoute = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/api/admin/orders/route.ts'),
      'utf-8',
    );

    assert.match(
      adminOrdersRoute,
      /\/api\/internal\/admin\/orders/,
      'Admin orders route must reference /api/internal/admin/orders',
    );
    assert.match(
      adminOrdersRoute,
      /forwardToErpAdmin/,
      'Admin orders route must call forwardToErpAdmin',
    );
  });

  // 14. Admin seed orders cannot appear in production API
  it('14. proves admin seed orders cannot appear in production API', () => {
    const adminOrdersRoute = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/api/admin/orders/route.ts'),
      'utf-8',
    );

    assert.doesNotMatch(
      adminOrdersRoute,
      /SEED_ORDERS/,
      'Production API route must never reference SEED_ORDERS',
    );
  });

  // 15. Unsupported admin mutation fails closed
  it('15. proves unsupported admin mutation fails closed with 501', () => {
    const adminOrdersRoute = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/api/admin/orders/route.ts'),
      'utf-8',
    );
    const adminOrderDetailRoute = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/api/admin/orders/[id]/route.ts'),
      'utf-8',
    );

    assert.match(
      adminOrdersRoute,
      /status:\s*501/,
      'Admin POST orders must return 501',
    );
    assert.match(
      adminOrderDetailRoute,
      /status:\s*501/,
      'Admin PATCH order must return 501',
    );
  });

  // 16. No ERP secret reaches browser
  it('16. proves no ERP secret reaches browser client config', () => {
    const clientFiles = [
      'src/lib/checkout-client.ts',
      'src/lib/catalog.ts',
      'src/store/cartStore.ts',
      'src/app/checkout/page.tsx',
    ];

    for (const relPath of clientFiles) {
      const fullPath = path.resolve(process.cwd(), relPath);
      const content = fs.readFileSync(fullPath, 'utf-8');

      assert.doesNotMatch(
        content,
        /ERP_SERVICE_TOKEN/,
        `${relPath} must not reference ERP_SERVICE_TOKEN`,
      );
      assert.doesNotMatch(
        content,
        /BITESHIP_API_KEY/,
        `${relPath} must not reference BITESHIP_API_KEY`,
      );
    }
  });

  // 17. No preview stock/inventory becomes authority
  it('17. proves preview stock or inventory cannot act as transactional authority', () => {
    const cartStoreSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/store/cartStore.ts'),
      'utf-8',
    );

    assert.doesNotMatch(
      cartStoreSource,
      /DEFAULT_STOCKS/,
      'cartStore must not contain default stock values',
    );
    assert.doesNotMatch(
      cartStoreSource,
      /available_stock|reserveStock/i,
      'cartStore must not track or assert stock authority',
    );
  });
});
