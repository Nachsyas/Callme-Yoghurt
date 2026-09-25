<?php

use App\Http\Controllers\Admin\AdminAuthController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\Internal\CatalogController;
use App\Http\Controllers\Internal\OrderController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public API Routes
|--------------------------------------------------------------------------
*/
Route::get('/health', [HealthController::class, 'health']);
Route::get('/ready', [HealthController::class, 'ready']);

/*
|--------------------------------------------------------------------------
| Admin Authentication Routes (Phase 1.2B)
|--------------------------------------------------------------------------
*/
Route::prefix('admin')->group(function () {
    Route::post('/login', [AdminAuthController::class, 'login']);
    Route::post('/logout', [AdminAuthController::class, 'logout']);
});

/*
|--------------------------------------------------------------------------
| Internal Service-to-Service Protected Routes (BFF -> ERP Core)
|--------------------------------------------------------------------------
*/
use App\Http\Controllers\Internal\Admin\AdminCatalogController;
use App\Http\Controllers\Internal\Admin\AdminInventoryController;

Route::middleware('service.auth')->prefix('internal')->group(function () {
    Route::get('/health', [HealthController::class, 'internalHealth']);
    Route::get('/catalog/products', [CatalogController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);

    /*
    |--------------------------------------------------------------------------
    | Internal Admin Management Routes (Phase 1.7C)
    | Protected by both service token authentication and admin actor verification
    |--------------------------------------------------------------------------
    */
    Route::middleware('admin.actor')->prefix('admin')->group(function () {
        // Catalog Management
        Route::get('/catalog/products', [AdminCatalogController::class, 'index']);
        Route::post('/catalog/products', [AdminCatalogController::class, 'storeProduct']);
        Route::put('/catalog/products/{id}', [AdminCatalogController::class, 'updateProduct']);
        Route::delete('/catalog/products/{id}', [AdminCatalogController::class, 'deactivateProduct']);
        Route::post('/catalog/variants', [AdminCatalogController::class, 'storeVariant']);
        Route::put('/catalog/variants/{id}', [AdminCatalogController::class, 'updateVariant']);
        Route::delete('/catalog/variants/{id}', [AdminCatalogController::class, 'deactivateVariant']);
        Route::post('/catalog/variants/{id}/price', [AdminCatalogController::class, 'changePrice']);

        // Inventory Management
        Route::get('/inventory/items', [AdminInventoryController::class, 'indexItems']);
        Route::post('/inventory/items', [AdminInventoryController::class, 'storeItem']);
        Route::put('/inventory/items/{id}', [AdminInventoryController::class, 'updateItem']);
        Route::delete('/inventory/items/{id}', [AdminInventoryController::class, 'deactivateItem']);
        Route::get('/inventory/lots', [AdminInventoryController::class, 'indexLots']);
        Route::post('/inventory/receipts', [AdminInventoryController::class, 'receiveStock']);
        Route::post('/inventory/adjustments', [AdminInventoryController::class, 'adjustStock']);
        Route::get('/inventory/ledger', [AdminInventoryController::class, 'indexLedger']);
        Route::get('/inventory/meta', [AdminInventoryController::class, 'indexMeta']);
    });
});

