<?php

declare(strict_types=1);

namespace App\Http\Controllers\Internal;

use App\Application\Shipping\GetShippingQuotesService;
use App\Domain\Pricing\Exceptions\InactiveVariantException;
use App\Domain\Shipping\Exceptions\ShippingProviderException;
use App\Domain\Shipping\Exceptions\UnmeasuredShippingWeightException;
use App\Http\Requests\Internal\GetShippingQuotesRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Log;
use Throwable;

class ShippingQuoteController extends Controller
{
    /**
     * Compute authoritative shipping quotes.
     */
    public function quotes(GetShippingQuotesRequest $request, GetShippingQuotesService $service): JsonResponse
    {
        $validated = $request->validated();
        $items = $validated['items'];

        $destination = [
            'area_id' => $validated['destination_area_id'] ?? null,
            'postal_code' => $validated['destination_postal_code'] ?? null,
            'latitude' => $validated['destination_latitude'] ?? null,
            'longitude' => $validated['destination_longitude'] ?? null,
            'city' => $validated['city'] ?? null,
            'province' => $validated['province'] ?? null,
            'district' => $validated['district'] ?? null,
        ];

        try {
            $result = $service->execute($destination, $items);

            return response()->json([
                'success' => true,
                'quotes' => $result['quotes'],
                'service_fee' => $result['service_fee'],
                'storage_warning' => $result['storage_warning'],
            ], 200, ['Cache-Control' => 'no-store']);
        } catch (UnmeasuredShippingWeightException $e) {
            Log::warning('Shipping quote blocked: unmeasured variant weight', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error_code' => 'UNMEASURED_SHIPPING_WEIGHT',
                'error' => $e->getMessage(),
                'quotes' => [],
            ], 422, ['Cache-Control' => 'no-store']);
        } catch (InactiveVariantException $e) {
            return response()->json([
                'success' => false,
                'error_code' => 'INACTIVE_VARIANT',
                'error' => $e->getMessage(),
                'quotes' => [],
            ], 422, ['Cache-Control' => 'no-store']);
        } catch (ShippingProviderException $e) {
            Log::error('Shipping quote provider error', [
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error_code' => 'SHIPPING_PROVIDER_ERROR',
                'error' => $e->getMessage(),
                'quotes' => [],
            ], 502, ['Cache-Control' => 'no-store']);
        } catch (Throwable $e) {
            Log::error('Unexpected error calculating shipping quotes', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error_code' => 'INTERNAL_ERROR',
                'error' => 'Gagal menghitung tarif pengiriman.',
                'quotes' => [],
            ], 500, ['Cache-Control' => 'no-store']);
        }
    }

    /**
     * Get authoritative service fee configuration ("Biaya Layanan").
     */
    public function feeConfig(): JsonResponse
    {
        $rawFee = config('shipping.service_fee_idr');

        return response()->json([
            'success' => true,
            'service_fee' => [
                'is_configured' => $rawFee !== null,
                'amount' => $rawFee !== null ? (int) $rawFee : null,
                'name' => 'Biaya Layanan',
                'status' => $rawFee !== null ? 'CONFIGURED' : 'BLOCKED — OWNER FEE VALUE REQUIRED',
            ],
        ], 200, ['Cache-Control' => 'no-store']);
    }
}
