<?php

use App\Http\Controllers\HealthController;
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
| Internal Service-to-Service Protected Routes (BFF -> ERP Core)
|--------------------------------------------------------------------------
*/
Route::middleware('service.auth')->prefix('internal')->group(function () {
    Route::get('/health', [HealthController::class, 'internalHealth']);
    Route::post('/orders', [OrderController::class, 'store']);
});
