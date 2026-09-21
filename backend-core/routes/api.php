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
Route::middleware('service.auth')->prefix('internal')->group(function () {
    Route::get('/health', [HealthController::class, 'internalHealth']);
    Route::get('/catalog/products', [CatalogController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
});
