<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Biteship API Configuration
    |--------------------------------------------------------------------------
    |
    | Configuration for interacting with Biteship Rates API.
    | API Key must remain server-side in ERP infrastructure and never be exposed.
    |
    */
    'biteship' => [
        'api_key' => env('BITESHIP_API_KEY'),
        'base_url' => env('BITESHIP_BASE_URL', 'https://api.biteship.com'),
        'timeout_seconds' => (int) env('BITESHIP_TIMEOUT_SECONDS', 8),
    ],

    /*
    |--------------------------------------------------------------------------
    | Authoritative Origin Location (SOP 01)
    |--------------------------------------------------------------------------
    |
    | High-level origin: Bambu Apus, Cipayung, Jakarta Timur.
    | Exact coordinates / street address must come from owner-confirmed business data.
    |
    */
    'origin' => [
        'area_name' => 'Bambu Apus, Cipayung, Jakarta Timur',
        'postal_code' => env('SHIPPING_ORIGIN_POSTAL_CODE'),
        'latitude' => env('SHIPPING_ORIGIN_LATITUDE') !== null && env('SHIPPING_ORIGIN_LATITUDE') !== '' ? (float) env('SHIPPING_ORIGIN_LATITUDE') : null,
        'longitude' => env('SHIPPING_ORIGIN_LONGITUDE') !== null && env('SHIPPING_ORIGIN_LONGITUDE') !== '' ? (float) env('SHIPPING_ORIGIN_LONGITUDE') : null,
        'is_verified' => filter_var(env('SHIPPING_ORIGIN_VERIFIED', false), FILTER_VALIDATE_BOOLEAN),
    ],

    /*
    |--------------------------------------------------------------------------
    | Authoritative Biaya Layanan (Service Fee IDR)
    |--------------------------------------------------------------------------
    |
    | Server-authoritative service fee configuration owned by ERP.
    | If null/unconfigured, payment commitment fails closed with
    | 'BLOCKED — OWNER FEE VALUE REQUIRED'.
    |
    */
    'service_fee_idr' => env('SERVICE_FEE_IDR') !== null && env('SERVICE_FEE_IDR') !== ''
        ? (int) env('SERVICE_FEE_IDR')
        : null,

    /*
    |--------------------------------------------------------------------------
    | Ephemeral Shipping Quote Cache TTL & Store
    |--------------------------------------------------------------------------
    |
    | Duration (in seconds) that an opaque shipping quote ID remains valid.
    | Default: 900 seconds (15 minutes). Old rates must expire and cannot be
    | reused indefinitely.
    |
    */
    'quote_ttl_seconds' => (int) env('SHIPPING_QUOTE_TTL_SECONDS', 900),

    /*
    | Cache store for ephemeral quote storage. In production, Redis is strictly required.
    */
    'cache_store' => env('SHIPPING_CACHE_STORE'),
];
