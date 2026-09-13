<?php

declare(strict_types=1);

namespace App\Http\Controllers\Internal;

use App\Application\Sales\CreateCheckoutOrderService;
use App\Domain\Inventory\Exceptions\FulfillmentWarehouseUnavailableException;
use App\Domain\Inventory\Exceptions\InsufficientInventoryException;
use App\Domain\Pricing\Exceptions\InactiveVariantException;
use App\Domain\Pricing\Exceptions\VariantPriceUnavailableException;
use App\Domain\Sales\Exceptions\IdempotencyConflictException;
use App\Http\Requests\Internal\CreateOrderRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Log;
use Throwable;

class OrderController extends Controller
{
    /**
     * Create a server-authoritative checkout order.
     *
     * Invariants (ADR-0005):
     * - ERP Core and PostgreSQL are sole authorities for pricing, total, stock, lots, and order status.
     * - Successful response returns minimal sanitized DTO matching BFF contract.
     * - Replays return HTTP 200; new orders return HTTP 201.
     * - Zero PII, secrets, or internal identifiers leaked in responses or logs.
     */
    public function store(CreateOrderRequest $request, CreateCheckoutOrderService $service): JsonResponse
    {
        $requestId = (string) ($request->header('X-Request-Id') ?? '');
        $rawIdempotencyKey = (string) $request->header('Idempotency-Key');

        try {
            $result = $service->execute($request->validated(), $rawIdempotencyKey);
            $order = $result['order'];
            $isReplay = $result['is_replay'];

            $statusCode = $isReplay ? 200 : 201;

            // Safe structured logging: zero PII, zero tokens, zero raw payloads
            Log::info('ERP checkout order processed', [
                'request_id' => $requestId,
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'is_replay' => $isReplay,
                'status_code' => $statusCode,
            ]);

            return response()->json([
                'order_id' => $order->id,
                'order_number' => $order->order_number,
                'status' => $order->status->value,
                'total_amount' => $order->total_amount,
            ], $statusCode);
        } catch (InsufficientInventoryException $e) {
            Log::warning('Checkout failed: insufficient inventory', [
                'request_id' => $requestId,
                'error_category' => 'insufficient_inventory',
            ]);

            return response()->json([
                'error' => 'Insufficient inventory available for one or more requested items',
            ], 409);
        } catch (IdempotencyConflictException $e) {
            Log::warning('Checkout failed: idempotency conflict', [
                'request_id' => $requestId,
                'error_category' => 'idempotency_conflict',
            ]);

            return response()->json([
                'error' => 'Idempotency key reused with different request payload',
            ], 409);
        } catch (FulfillmentWarehouseUnavailableException $e) {
            Log::error('Checkout unavailable: fulfillment warehouse failure', [
                'request_id' => $requestId,
                'error_category' => 'warehouse_unavailable',
            ]);

            return response()->json([
                'error' => 'Checkout service is temporarily unavailable',
            ], 503);
        } catch (InactiveVariantException $e) {
            Log::warning('Checkout validation failed: variant inactive', [
                'request_id' => $requestId,
                'error_category' => 'inactive_variant',
            ]);

            return response()->json([
                'error' => 'Requested product variant is inactive or unavailable',
            ], 422);
        } catch (VariantPriceUnavailableException $e) {
            Log::warning('Checkout validation failed: price unavailable', [
                'request_id' => $requestId,
                'error_category' => 'price_unavailable',
            ]);

            return response()->json([
                'error' => 'Active retail price is unavailable for requested variant',
            ], 422);
        } catch (Throwable $e) {
            // Check for unconfigured secret key fail-closed
            if (str_contains($e->getMessage(), 'fingerprint key is not configured')) {
                Log::error('Checkout configuration missing: fingerprint key unconfigured', [
                    'request_id' => $requestId,
                ]);

                return response()->json([
                    'error' => 'Checkout service is temporarily unavailable',
                ], 503);
            }

            Log::error('Checkout unexpected internal error', [
                'request_id' => $requestId,
                'error_class' => get_class($e),
            ]);

            return response()->json([
                'error' => 'An unexpected internal error occurred processing the order',
            ], 500);
        }
    }
}
