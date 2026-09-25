<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Admin\Enums\AdminRole;
use App\Domain\Admin\Enums\AdminStatus;
use App\Domain\Admin\Models\AdminAuditLog;
use App\Domain\Admin\Models\AdminUser;
use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Pricing\Models\ProductVariantPrice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminCatalogManagementTest extends TestCase
{
    use RefreshDatabase;

    private string $serviceToken = 'test-erp-service-token-secret-64ch';
    private AdminUser $owner;
    private UnitOfMeasure $uomMl;
    private InventoryItem $inventoryItem;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.internal.service_token' => $this->serviceToken]);

        $this->owner = new AdminUser();
        $this->owner->name = 'Owner User';
        $this->owner->email = 'owner@callmeyoghurt.com';
        $this->owner->setPassword('StrongPassword1234!');
        $this->owner->role = AdminRole::OWNER;
        $this->owner->status = AdminStatus::ACTIVE;
        $this->owner->save();

        $this->uomMl = UnitOfMeasure::create([
            'code' => 'ML',
            'name' => 'Milliliters',
            'category' => 'VOLUME',
        ]);

        $this->inventoryItem = InventoryItem::create([
            'code' => 'FG-TEST-YOGHURT',
            'name' => 'Finished Yoghurt Base',
            'type' => ItemType::FINISHED_GOOD,
            'base_uom_id' => $this->uomMl->id,
            'lot_tracked' => true,
            'active' => true,
        ]);
    }

    private function authHeaders(?AdminUser $user = null): array
    {
        $actor = $user ?? $this->owner;
        return [
            'Authorization' => 'Bearer ' . $this->serviceToken,
            'X-Admin-User-Id' => (string) $actor->id,
            'X-Admin-Role' => $actor->role->value,
        ];
    }

    public function test_can_list_products(): void
    {
        $product = Product::create([
            'name' => 'Yoghurt Mangga',
            'slug' => 'yoghurt-mangga',
            'description' => 'Mangga segar',
            'active' => true,
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->getJson('/api/internal/admin/catalog/products');

        $response->assertStatus(200);
        $response->assertJsonStructure(['products' => [['id', 'name', 'slug', 'variants']]]);
        $response->assertJsonFragment(['slug' => 'yoghurt-mangga']);
    }

    public function test_can_create_product(): void
    {
        $response = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/catalog/products', [
                'name' => 'Yoghurt Stroberi',
                'slug' => 'yoghurt-stroberi',
                'description' => 'Rasa stroberi asli',
                'active' => true,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('products', [
            'slug' => 'yoghurt-stroberi',
            'name' => 'Yoghurt Stroberi',
            'active' => true,
        ]);

        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'CATALOG_PRODUCT_CREATED',
            'admin_user_id' => $this->owner->id,
        ]);
    }

    public function test_create_product_rejects_duplicate_slug(): void
    {
        Product::create([
            'name' => 'Duplicate Slug',
            'slug' => 'same-slug',
            'active' => true,
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/catalog/products', [
                'name' => 'Another Product',
                'slug' => 'same-slug',
            ]);

        $response->assertStatus(422);
    }

    public function test_can_update_product(): void
    {
        $product = Product::create([
            'name' => 'Original Name',
            'slug' => 'original-slug',
            'active' => true,
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->putJson('/api/internal/admin/catalog/products/' . $product->id, [
                'name' => 'Updated Name',
                'description' => 'New description',
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'name' => 'Updated Name',
            'description' => 'New description',
        ]);

        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'CATALOG_PRODUCT_UPDATED',
            'admin_user_id' => $this->owner->id,
        ]);
    }

    public function test_can_deactivate_product(): void
    {
        $product = Product::create([
            'name' => 'To Deactivate',
            'slug' => 'to-deactivate',
            'active' => true,
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->deleteJson('/api/internal/admin/catalog/products/' . $product->id);

        $response->assertStatus(200);
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'active' => false,
        ]);

        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'CATALOG_PRODUCT_DEACTIVATED',
            'admin_user_id' => $this->owner->id,
        ]);
    }

    public function test_can_create_variant_and_rejects_duplicate_sku(): void
    {
        $product = Product::create([
            'name' => 'Plain Product',
            'slug' => 'plain-product',
            'active' => true,
        ]);

        $response = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/catalog/variants', [
                'product_id' => $product->id,
                'inventory_item_id' => $this->inventoryItem->id,
                'sku' => 'CY-PLAIN-250',
                'variant_name' => '250 ml Bottle',
                'net_content_quantity' => 250,
                'net_content_uom_id' => $this->uomMl->id,
                'price' => 15000,
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('product_variants', [
            'sku' => 'CY-PLAIN-250',
            'variant_name' => '250 ml Bottle',
        ]);
        $this->assertDatabaseHas('product_variant_prices', [
            'currency' => 'IDR',
            'amount' => 15000,
            'active' => true,
        ]);

        // Attempt duplicate SKU
        $duplicateResponse = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/catalog/variants', [
                'product_id' => $product->id,
                'inventory_item_id' => $this->inventoryItem->id,
                'sku' => 'CY-PLAIN-250',
                'variant_name' => 'Another Bottle',
            ]);

        $duplicateResponse->assertStatus(422);
    }

    public function test_can_update_variant_and_deactivate_variant(): void
    {
        $product = Product::create([
            'name' => 'Plain Product',
            'slug' => 'plain-product-2',
            'active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $this->inventoryItem->id,
            'sku' => 'CY-PLAIN-UPDATE',
            'variant_name' => 'Old Name',
            'net_content_quantity' => 250,
            'net_content_uom_id' => $this->uomMl->id,
            'active' => true,
        ]);

        $updateResponse = $this->withHeaders($this->authHeaders())
            ->putJson('/api/internal/admin/catalog/variants/' . $variant->id, [
                'variant_name' => 'New Name',
            ]);

        $updateResponse->assertStatus(200);
        $this->assertDatabaseHas('product_variants', [
            'id' => $variant->id,
            'variant_name' => 'New Name',
        ]);

        $deactivateResponse = $this->withHeaders($this->authHeaders())
            ->deleteJson('/api/internal/admin/catalog/variants/' . $variant->id);

        $deactivateResponse->assertStatus(200);
        $this->assertDatabaseHas('product_variants', [
            'id' => $variant->id,
            'active' => false,
        ]);
    }

    public function test_price_change_preserves_history_and_maintains_single_active_idr_price(): void
    {
        $product = Product::create([
            'name' => 'Vanilla Product',
            'slug' => 'vanilla-prod',
            'active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $this->inventoryItem->id,
            'sku' => 'CY-VANILLA-250',
            'variant_name' => '250 ml',
            'active' => true,
        ]);

        // 1. Initial price setting
        $res1 = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/catalog/variants/' . $variant->id . '/price', [
                'amount' => 15000,
            ]);
        $res1->assertStatus(200);

        // 2. Change price
        $res2 = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/catalog/variants/' . $variant->id . '/price', [
                'amount' => 18000,
            ]);
        $res2->assertStatus(200);

        // Assert 2 rows exist: 1 inactive (15000) and 1 active (18000)
        $this->assertDatabaseCount('product_variant_prices', 2);
        $this->assertDatabaseHas('product_variant_prices', [
            'product_variant_id' => $variant->id,
            'amount' => 15000,
            'active' => false,
        ]);
        $this->assertDatabaseHas('product_variant_prices', [
            'product_variant_id' => $variant->id,
            'amount' => 18000,
            'active' => true,
        ]);

        // Audit log recorded
        $this->assertDatabaseHas('admin_audit_logs', [
            'action' => 'CATALOG_PRICE_CHANGED',
            'admin_user_id' => $this->owner->id,
        ]);
    }

    public function test_unauthorized_requests_are_rejected(): void
    {
        // 1. Missing bearer token -> 401
        $res1 = $this->getJson('/api/internal/admin/catalog/products');
        $res1->assertStatus(401);

        // 2. Missing admin actor headers -> 403
        $res2 = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->serviceToken,
        ])->getJson('/api/internal/admin/catalog/products');
        $res2->assertStatus(403);

        // 3. Inactive admin user -> 403
        $inactiveAdmin = new AdminUser();
        $inactiveAdmin->name = 'Inactive';
        $inactiveAdmin->email = 'inactive@callmeyoghurt.com';
        $inactiveAdmin->setPassword('SecretPassword123!');
        $inactiveAdmin->role = AdminRole::ADMIN;
        $inactiveAdmin->status = AdminStatus::DISABLED;
        $inactiveAdmin->save();

        $res3 = $this->withHeaders($this->authHeaders($inactiveAdmin))
            ->getJson('/api/internal/admin/catalog/products');
        $res3->assertStatus(403);

        // 4. Role mismatch -> 403
        $res4 = $this->withHeaders([
            'Authorization' => 'Bearer ' . $this->serviceToken,
            'X-Admin-User-Id' => (string) $this->owner->id,
            'X-Admin-Role' => 'ADMIN', // Owner has role OWNER, not ADMIN
        ])->getJson('/api/internal/admin/catalog/products');
        $res4->assertStatus(403);
    }

    public function test_price_change_rejects_zero_negative_and_decimal_amount(): void
    {
        $product = Product::create([
            'name' => 'Price Test',
            'slug' => 'price-test',
            'description' => 'Test',
            'active' => true,
        ]);

        $variant = ProductVariant::create([
            'product_id' => $product->id,
            'inventory_item_id' => $this->inventoryItem->id,
            'sku' => 'CY-PRICE-TEST',
            'variant_name' => 'Price Test Variant',
            'active' => true,
        ]);

        // Zero price rejected (422)
        $resZero = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/catalog/variants/' . $variant->id . '/price', [
                'amount' => 0,
            ]);
        $resZero->assertStatus(422);

        // Negative price rejected (422)
        $resNeg = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/catalog/variants/' . $variant->id . '/price', [
                'amount' => -1000,
            ]);
        $resNeg->assertStatus(422);

        // Decimal price rejected (422)
        $resDec = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/catalog/variants/' . $variant->id . '/price', [
                'amount' => 15000.5,
            ]);
        $resDec->assertStatus(422);

        // Empty price rejected (422)
        $resEmpty = $this->withHeaders($this->authHeaders())
            ->postJson('/api/internal/admin/catalog/variants/' . $variant->id . '/price', [
                'amount' => '',
            ]);
        $resEmpty->assertStatus(422);
    }
}
