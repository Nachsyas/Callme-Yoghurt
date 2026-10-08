<?php

declare(strict_types=1);

namespace App\Domain\Security\Services;

class ProductionConfigValidator
{
    /**
     * Minimum character lengths for cryptographic and service secrets.
     */
    public const MIN_SECRET_LENGTH_DEFAULT = 32;
    public const MIN_ADMIN_SECRET_LENGTH = 16;

    /**
     * Validate production configuration.
     *
     * Invariants (Section 10):
     * - Centralized validation of all security-critical configuration.
     * - Fails clearly when any critical variable is missing, empty, or insecure.
     * - NEVER prints secret values or logs secrets.
     * - Validates presence and minimum entropy/length constraints.
     *
     * @param bool $strict If true, enforces production rules regardless of APP_ENV.
     * @return array{passed: bool, errors: array<string, string>, warnings: array<string, string>, audited: array<string, string>}
     */
    public function validate(bool $strict = false): array
    {
        $isProduction = $strict || app()->environment('production');
        $errors = [];
        $warnings = [];
        $audited = [];

        // 1. APP_KEY
        $appKey = (string) config('app.key', '');
        if ($appKey === '') {
            $errors['APP_KEY'] = 'Missing or empty. Required for encryption (base64:32-bytes).';
            $audited['APP_KEY'] = 'MISSING';
        } elseif (!str_starts_with($appKey, 'base64:') && strlen($appKey) < self::MIN_SECRET_LENGTH_DEFAULT) {
            $errors['APP_KEY'] = 'Insecure format or insufficient length (minimum 32 characters or base64 key).';
            $audited['APP_KEY'] = 'INVALID_LENGTH';
        } else {
            $audited['APP_KEY'] = 'OK';
        }

        // 2. APP_DEBUG
        $appDebug = config('app.debug');
        if ($isProduction && $appDebug === true) {
            $errors['APP_DEBUG'] = 'APP_DEBUG must be false in production to prevent stack trace and secret leakage.';
            $audited['APP_DEBUG'] = 'INSECURE (true)';
        } else {
            $audited['APP_DEBUG'] = 'OK (' . ($appDebug ? 'true' : 'false') . ')';
        }

        // 3. ERP_SERVICE_TOKEN (BFF -> ERP Core S2S Auth)
        $serviceToken = (string) config('services.internal.service_token', '');
        if ($serviceToken === '') {
            $errors['ERP_SERVICE_TOKEN'] = 'Missing or empty. Internal BFF-to-ERP service communication requires this token.';
            $audited['ERP_SERVICE_TOKEN'] = 'MISSING';
        } elseif (strlen($serviceToken) < self::MIN_SECRET_LENGTH_DEFAULT) {
            $errors['ERP_SERVICE_TOKEN'] = sprintf(
                'Insufficient length (%d chars). Minimum %d characters required.',
                strlen($serviceToken),
                self::MIN_SECRET_LENGTH_DEFAULT
            );
            $audited['ERP_SERVICE_TOKEN'] = 'INVALID_LENGTH';
        } else {
            $audited['ERP_SERVICE_TOKEN'] = 'OK';
        }

        // 4. CRM_PII_BLIND_INDEX_KEY (HMAC-SHA256 Blind Index Key)
        $blindIndexKey = (string) config('crm.pii_blind_index_key', '');
        if ($blindIndexKey === '') {
            $errors['CRM_PII_BLIND_INDEX_KEY'] = 'Missing or empty. Required for encrypted PII indexing.';
            $audited['CRM_PII_BLIND_INDEX_KEY'] = 'MISSING';
        } elseif (strlen($blindIndexKey) < self::MIN_SECRET_LENGTH_DEFAULT) {
            $errors['CRM_PII_BLIND_INDEX_KEY'] = sprintf(
                'Insufficient length (%d chars). Minimum %d characters required.',
                strlen($blindIndexKey),
                self::MIN_SECRET_LENGTH_DEFAULT
            );
            $audited['CRM_PII_BLIND_INDEX_KEY'] = 'INVALID_LENGTH';
        } else {
            $audited['CRM_PII_BLIND_INDEX_KEY'] = 'OK';
        }

        // 5. CHECKOUT_FINGERPRINT_KEY (HMAC-SHA256 Idempotent Request Key)
        $fingerprintKey = (string) config('checkout.fingerprint_key', '');
        if ($fingerprintKey === '') {
            $errors['CHECKOUT_FINGERPRINT_KEY'] = 'Missing or empty. Required for checkout replay & idempotency protection.';
            $audited['CHECKOUT_FINGERPRINT_KEY'] = 'MISSING';
        } elseif (strlen($fingerprintKey) < self::MIN_SECRET_LENGTH_DEFAULT) {
            $errors['CHECKOUT_FINGERPRINT_KEY'] = sprintf(
                'Insufficient length (%d chars). Minimum %d characters required.',
                strlen($fingerprintKey),
                self::MIN_SECRET_LENGTH_DEFAULT
            );
            $audited['CHECKOUT_FINGERPRINT_KEY'] = 'INVALID_LENGTH';
        } else {
            $audited['CHECKOUT_FINGERPRINT_KEY'] = 'OK';
        }

        // 6. ADMIN_SESSION_SECRET (Admin Session HMAC Secret)
        $adminSessionSecret = (string) (config('services.admin.session_secret') ?? env('ADMIN_SESSION_SECRET', ''));
        if ($adminSessionSecret === '') {
            $errors['ADMIN_SESSION_SECRET'] = 'Missing or empty. Required for admin session token signing.';
            $audited['ADMIN_SESSION_SECRET'] = 'MISSING';
        } elseif (strlen($adminSessionSecret) < self::MIN_ADMIN_SECRET_LENGTH) {
            $errors['ADMIN_SESSION_SECRET'] = sprintf(
                'Insufficient length (%d chars). Minimum %d characters required.',
                strlen($adminSessionSecret),
                self::MIN_ADMIN_SECRET_LENGTH
            );
            $audited['ADMIN_SESSION_SECRET'] = 'INVALID_LENGTH';
        } else {
            $audited['ADMIN_SESSION_SECRET'] = 'OK';
        }

        // 7. Database Driver & Credentials
        $dbConnection = config('database.default', 'pgsql');
        if ($isProduction && $dbConnection !== 'pgsql') {
            $errors['DB_CONNECTION'] = "Insecure database driver [{$dbConnection}]. PostgreSQL ('pgsql') is mandatory in production (ADR-0001).";
            $audited['DB_CONNECTION'] = "INVALID ({$dbConnection})";
        } else {
            $audited['DB_CONNECTION'] = 'OK (' . $dbConnection . ')';
        }

        $dbPassword = (string) config('database.connections.pgsql.password', '');
        if ($isProduction && $dbPassword === '') {
            $errors['DB_PASSWORD'] = 'Database password is empty in production.';
            $audited['DB_PASSWORD'] = 'MISSING';
        } else {
            $audited['DB_PASSWORD'] = 'OK';
        }

        // 8. Cache & Ephemeral Storage (Redis mandatory in production)
        $cacheStore = (string) (config('cache.default') ?? env('CACHE_STORE', 'file'));
        $shippingStore = (string) (config('shipping.cache_store') ?? env('SHIPPING_CACHE_STORE', ''));

        if ($isProduction) {
            if ($cacheStore !== 'redis') {
                $errors['CACHE_STORE'] = "Insecure cache store [{$cacheStore}] in production. Distributed Redis ('redis') is required.";
                $audited['CACHE_STORE'] = "INVALID ({$cacheStore})";
            } else {
                $audited['CACHE_STORE'] = 'OK (redis)';
            }

            if ($shippingStore !== '' && $shippingStore !== 'redis') {
                $errors['SHIPPING_CACHE_STORE'] = "Insecure shipping cache store [{$shippingStore}] in production. Must be 'redis'.";
                $audited['SHIPPING_CACHE_STORE'] = "INVALID ({$shippingStore})";
            } else {
                $audited['SHIPPING_CACHE_STORE'] = 'OK (' . ($shippingStore ?: 'defaults to redis') . ')';
            }
        } else {
            $audited['CACHE_STORE'] = 'OK (' . $cacheStore . ')';
            $audited['SHIPPING_CACHE_STORE'] = 'OK (' . ($shippingStore ?: 'unconfigured') . ')';
        }

        // 9. Hashing Driver (SOP 04 Mandate: Argon2id)
        $hashDriver = (string) config('hashing.driver', 'argon2id');
        if ($isProduction && $hashDriver !== 'argon2id') {
            $errors['HASH_DRIVER'] = "Insecure hash driver [{$hashDriver}]. 'argon2id' is mandatory per SOP 04.";
            $audited['HASH_DRIVER'] = "INVALID ({$hashDriver})";
        } else {
            $audited['HASH_DRIVER'] = 'OK (' . $hashDriver . ')';
        }

        // 10. Owner-Blocked Business Configuration (Warning / Informational)
        $serviceFee = config('shipping.service_fee_idr');
        if ($serviceFee === null) {
            $warnings['SERVICE_FEE_IDR'] = 'BLOCKED — OWNER FEE VALUE REQUIRED. Checkout will fail closed until owner configures fee.';
            $audited['SERVICE_FEE_IDR'] = 'BLOCKED (null)';
        } else {
            $audited['SERVICE_FEE_IDR'] = 'CONFIGURED (' . (int) $serviceFee . ' IDR)';
        }

        $originPostal = config('shipping.origin.postal_code');
        $originVerified = config('shipping.origin.is_verified');
        if (empty($originPostal) || !$originVerified) {
            $warnings['SHIPPING_ORIGIN'] = 'Incomplete or unverified shipping origin. Shipping rate queries will fail closed.';
            $audited['SHIPPING_ORIGIN'] = 'UNVERIFIED';
        } else {
            $audited['SHIPPING_ORIGIN'] = 'OK (verified)';
        }

        return [
            'passed' => count($errors) === 0,
            'errors' => $errors,
            'warnings' => $warnings,
            'audited' => $audited,
        ];
    }
}
