<?php

declare(strict_types=1);

namespace App\Domain\CRM\Services;

use RuntimeException;

class PhoneBlindIndexService
{
    /**
     * Canonical Indonesian phone number normalization.
     *
     * Rules:
     * - Strips all non-digit characters (including spaces, dashes, parentheses, plus sign).
     * - Converts domestic prefix '0' (e.g. 0812...) to standard country code '62' (e.g. 62812...).
     * - Retains existing standard country code '62'.
     *
     * Examples of equivalent inputs normalizing to '628123456789':
     * - '08123456789'
     * - '628123456789'
     * - '+628123456789'
     * - '+62 812-3456-789'
     */
    public static function normalize(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';

        if ($digits === '') {
            return '';
        }

        if (str_starts_with($digits, '0')) {
            $digits = '62' . substr($digits, 1);
        }

        return $digits;
    }

    /**
     * Generate deterministic keyed HMAC-SHA256 blind index for searchable phone lookup.
     *
     * @param string $phone Raw or partially formatted phone number.
     * @param string|null $secretKey Explicit key (for testing or caller injection).
     *                               If null, resolved via application configuration.
     * @throws RuntimeException If secret key is missing or empty (fails closed).
     */
    public static function generateBlindIndex(string $phone, ?string $secretKey = null): string
    {
        $key = $secretKey;

        // Resolve through application config, never direct env() in domain layer
        if ($key === null && function_exists('config')) {
            $resolved = config('crm.pii_blind_index_key');
            if (is_string($resolved) && $resolved !== '') {
                $key = $resolved;
            }
        }

        if ($key === null || $key === '') {
            throw new RuntimeException('CRM PII blind index key is not configured. Failing closed.');
        }

        $normalized = self::normalize($phone);

        return hash_hmac('sha256', $normalized, $key);
    }
}
