<?php

declare(strict_types=1);

namespace App\Domain\Shipping\Services;

class DestinationNormalizationService
{
    /**
     * Normalizes destination input deterministically.
     *
     * @param array<string, mixed> $destination
     * @return array{area_id: string, city: string, district: string, latitude: float|null, longitude: float|null, postal_code: string, province: string}
     */
    public static function normalize(array $destination): array
    {
        $normalized = [
            'area_id' => trim((string) ($destination['area_id'] ?? ($destination['destination_area_id'] ?? ''))),
            'city' => trim((string) ($destination['city'] ?? '')),
            'district' => trim((string) ($destination['district'] ?? '')),
            'latitude' => isset($destination['latitude']) && $destination['latitude'] !== null && $destination['latitude'] !== ''
                ? (float) $destination['latitude']
                : (isset($destination['destination_latitude']) && $destination['destination_latitude'] !== null && $destination['destination_latitude'] !== '' ? (float) $destination['destination_latitude'] : null),
            'longitude' => isset($destination['longitude']) && $destination['longitude'] !== null && $destination['longitude'] !== ''
                ? (float) $destination['longitude']
                : (isset($destination['destination_longitude']) && $destination['destination_longitude'] !== null && $destination['destination_longitude'] !== '' ? (float) $destination['destination_longitude'] : null),
            'postal_code' => trim((string) ($destination['postal_code'] ?? ($destination['destination_postal_code'] ?? ''))),
            'province' => trim((string) ($destination['province'] ?? '')),
        ];

        ksort($normalized);

        return $normalized;
    }

    /**
     * Computes deterministic SHA-256 hash of normalized destination.
     *
     * @param array<string, mixed> $destination
     */
    public static function computeFingerprint(array $destination): string
    {
        $normalized = self::normalize($destination);

        return hash('sha256', json_encode($normalized, JSON_THROW_ON_ERROR));
    }
}
