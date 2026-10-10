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
    public const REQUIRED_APP_KEY_BYTES = 32;

    /**
     * Validate production configuration.
     *
     * Invariants (Section 5, 6, 8, 9, 10, 13):
     * - Centralized validation of all security-critical configuration.
     * - Fails clearly when any critical variable is missing, empty, or insecure.
     * - NEVER prints secret values or logs secrets (APP_KEY, DB_URL, REDIS_URL, tokens).
     * - Validates presence, minimum entropy, and strict cryptographic constraints.
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

        // 1. APP_KEY — Strict Cryptographic Validation (Section 5)
        $rawAppKey = (string) config('app.key', '');
        if ($rawAppKey === '') {
            $errors['APP_KEY'] = 'Missing or empty. Required for AES-256 encryption (base64:32-bytes).';
            $audited['APP_KEY'] = 'MISSING';
        } else {
            $isBase64 = str_starts_with($rawAppKey, 'base64:');
            if ($isBase64) {
                $encoded = substr($rawAppKey, 7);
                if ($encoded === '') {
                    $errors['APP_KEY'] = 'Empty base64 payload after base64: prefix.';
                    $audited['APP_KEY'] = 'INVALID_BASE64';
                } else {
                    $decoded = base64_decode($encoded, true);
                    if ($decoded === false) {
                        $errors['APP_KEY'] = 'Invalid base64 encoding. Must be strictly valid base64.';
                        $audited['APP_KEY'] = 'INVALID_BASE64';
                    } elseif (strlen($decoded) !== self::REQUIRED_APP_KEY_BYTES) {
                        $errors['APP_KEY'] = sprintf(
                            'Invalid decoded key length (%d bytes). AES-256 requires exactly %d bytes.',
                            strlen($decoded),
                            self::REQUIRED_APP_KEY_BYTES
                        );
                        $audited['APP_KEY'] = 'WRONG_BYTE_LENGTH';
                    } else {
                        $audited['APP_KEY'] = 'OK (base64:32-bytes)';
                    }
                }
            } else {
                // Non-base64 raw key
                if (strlen($rawAppKey) !== self::REQUIRED_APP_KEY_BYTES) {
                    $errors['APP_KEY'] = sprintf(
                        'Raw key has invalid length (%d bytes). Must be exactly %d bytes or base64: prefixed.',
                        strlen($rawAppKey),
                        self::REQUIRED_APP_KEY_BYTES
                    );
                    $audited['APP_KEY'] = 'WRONG_BYTE_LENGTH';
                } else {
                    $audited['APP_KEY'] = 'OK (raw:32-bytes)';
                }
            }
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

        // 7. PostgreSQL Database Contract (Section 6, 8, 13)
        $dbConnection = config('database.default', 'pgsql');
        if ($isProduction && $dbConnection !== 'pgsql') {
            $errors['DB_CONNECTION'] = "Insecure database driver [{$dbConnection}]. PostgreSQL ('pgsql') is mandatory in production (ADR-0001).";
            $audited['DB_CONNECTION'] = "INVALID ({$dbConnection})";
        } else {
            $audited['DB_CONNECTION'] = 'OK (' . $dbConnection . ')';
        }

        if ($isProduction) {
            $dbUrl = (string) (config('database.connections.pgsql.url') ?? env('DB_URL', ''));
            if ($dbUrl !== '') {
                $parsed = parse_url($dbUrl);
                $scheme = $parsed['scheme'] ?? '';
                $hasHost = !empty($parsed['host']);
                if (!in_array($scheme, ['postgres', 'postgresql'], true) || !$hasHost) {
                    $errors['DB_URL'] = 'Malformed DB_URL. Must be a valid postgres:// or postgresql:// URL with host.';
                    $audited['DB_CONFIG'] = 'INVALID_DB_URL';
                } else {
                    $audited['DB_CONFIG'] = 'OK (DB_URL configured)';
                }
            } else {
                $host = (string) (config('database.connections.pgsql.host') ?? env('DB_HOST', ''));
                $db = (string) (config('database.connections.pgsql.database') ?? env('DB_DATABASE', ''));
                $user = (string) (config('database.connections.pgsql.username') ?? env('DB_USERNAME', ''));
                $pass = (string) (config('database.connections.pgsql.password') ?? env('DB_PASSWORD', ''));

                if ($host === '' || $db === '' || $user === '' || $pass === '') {
                    $errors['DB_CONFIG'] = 'Incomplete PostgreSQL configuration. Provide either valid DB_URL or complete DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, and DB_PASSWORD.';
                    $audited['DB_CONFIG'] = 'INCOMPLETE_HOST_CONFIG';
                } else {
                    $audited['DB_CONFIG'] = 'OK (host-style configured)';
                }
            }
        } else {
            $audited['DB_CONFIG'] = 'OK (development mode)';
        }

        // 8. Redis Ephemeral Contract (Section 9, 10, 13)
        $redisUrl = (string) (config('database.redis.default.url') ?? env('REDIS_URL', ''));
        $redisHost = (string) (config('database.redis.default.host') ?? env('REDIS_HOST', ''));

        if ($isProduction) {
            if ($redisUrl !== '') {
                $parsedRedis = parse_url($redisUrl);
                $redisScheme = $parsedRedis['scheme'] ?? '';
                $hasRedisHost = !empty($parsedRedis['host']);
                if (!in_array($redisScheme, ['redis', 'rediss'], true) || !$hasRedisHost) {
                    $errors['REDIS_CONFIG'] = 'Malformed REDIS_URL. Must be a valid redis:// or rediss:// URL with host.';
                    $audited['REDIS_CONFIG'] = 'INVALID_REDIS_URL';
                } else {
                    $audited['REDIS_CONFIG'] = 'OK (REDIS_URL configured)';
                }
            } elseif ($redisHost !== '') {
                $audited['REDIS_CONFIG'] = 'OK (host-style configured)';
            } else {
                $errors['REDIS_CONFIG'] = 'Incomplete Redis configuration. Provide either valid REDIS_URL or REDIS_HOST.';
                $audited['REDIS_CONFIG'] = 'MISSING';
            }

            $cacheStore = (string) (config('cache.default') ?? env('CACHE_STORE', 'file'));
            $shippingStore = (string) (config('shipping.cache_store') ?? env('SHIPPING_CACHE_STORE', ''));

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
            $audited['REDIS_CONFIG'] = 'OK (development mode)';
            $audited['CACHE_STORE'] = 'OK (' . (config('cache.default') ?? 'file') . ')';
            $audited['SHIPPING_CACHE_STORE'] = 'OK (' . (config('shipping.cache_store') ?: 'unconfigured') . ')';
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
