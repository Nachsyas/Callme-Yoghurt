<?php

declare(strict_types=1);

namespace App\Infrastructure\Shipping;

use App\Domain\Shipping\Contracts\ShippingRateProviderInterface;
use App\Domain\Shipping\Exceptions\ShippingProviderException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class BiteshipRateProvider implements ShippingRateProviderInterface
{
    /**
     * Permitted couriers for Biteship rates queries.
     */
    protected const ALLOWED_COURIERS = 'grab,gojek,jne,tiki,sicepat,anteraja,paxel';

    /**
     * Query Biteship Rates API.
     *
     * Invariants:
     * - Only calls POST /v1/rates/couriers (Rates API).
     * - NEVER calls POST /v1/orders (Order API is strictly forbidden).
     * - Never leaks BITESHIP_API_KEY in logs, exceptions, or payloads.
     * - Fails closed if API key is missing or call fails.
     *
     * @param array<string, mixed> $origin
     * @param array<string, mixed> $destination
     * @param array<int, array<string, mixed>> $items
     * @return array<int, array<string, mixed>>
     */
    public function getRates(array $origin, array $destination, array $items): array
    {
        $apiKey = config('shipping.biteship.api_key');
        if (!is_string($apiKey) || trim($apiKey) === '') {
            throw new ShippingProviderException('Biteship API key is not configured in ERP.');
        }

        $baseUrl = rtrim((string) config('shipping.biteship.base_url', 'https://api.biteship.com'), '/');
        $timeout = (int) config('shipping.biteship.timeout_seconds', 8);

        // Enforce owner-verified origin invariants (Section 13)
        if (
            empty($origin['postal_code']) ||
            empty($origin['latitude']) ||
            empty($origin['longitude']) ||
            empty($origin['is_verified'])
        ) {
            throw new ShippingProviderException('Shipping origin configuration is incomplete or unverified. Rates request failed closed.');
        }

        // Build sanitized Biteship request payload
        $payload = [
            'origin_postal_code' => (int) $origin['postal_code'],
            'origin_latitude' => (float) $origin['latitude'],
            'origin_longitude' => (float) $origin['longitude'],
            'couriers' => self::ALLOWED_COURIERS,
            'items' => array_map(function (array $item) {
                return [
                    'name' => (string) ($item['name'] ?? 'Callme Yoghurt'),
                    'value' => (int) ($item['value'] ?? 16000),
                    'quantity' => (int) ($item['quantity'] ?? 1),
                    'weight' => (int) ($item['weight_grams'] ?? 0),
                ];
            }, $items),
        ];

        if (!empty($destination['postal_code'])) {
            $payload['destination_postal_code'] = (int) $destination['postal_code'];
        }
        if (!empty($destination['area_id'])) {
            $payload['destination_area_id'] = (string) $destination['area_id'];
        }
        if (!empty($destination['latitude']) && !empty($destination['longitude'])) {
            $payload['destination_latitude'] = (float) $destination['latitude'];
            $payload['destination_longitude'] = (float) $destination['longitude'];
        }

        try {
            // Official Biteship API auth contract uses API key directly without Bearer prefix (Section 12)
            $response = Http::withHeaders([
                'Authorization' => $apiKey,
                'Content-Type' => 'application/json',
            ])->timeout($timeout)->post("{$baseUrl}/v1/rates/couriers", $payload);

            if (!$response->successful()) {
                $status = $response->status();
                $body = $response->json();
                $rawError = is_array($body) ? ($body['error'] ?? ($body['message'] ?? 'Upstream error')) : 'Upstream error';

                // Safe logging: no API key, no customer PII
                Log::warning('Biteship Rates API returned non-success response', [
                    'status' => $status,
                    'error' => (string) $rawError,
                ]);

                throw new ShippingProviderException("Biteship Rates API error ({$status}): {$rawError}");
            }

            $data = $response->json();
            if (!is_array($data) || !isset($data['pricing']) || !is_array($data['pricing'])) {
                return [];
            }

            return $data['pricing'];
        } catch (ShippingProviderException $e) {
            throw $e;
        } catch (Throwable $e) {
            Log::error('Biteship Rates API network or transport failure', [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);

            throw new ShippingProviderException('Gangguan koneksi ke layanan tarif Biteship: ' . $e->getMessage(), 0, $e);
        }
    }
}
