<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Architecture Mandate (Phase 1.7C.21):
    | The Laravel ERP is an authoritative transactional business layer and is NOT
    | intended to be called directly by arbitrary public browsers.
    | Architecture remains:
    | Browser -> Next.js BFF -> Laravel ERP
    |
    | Internal service endpoints remain protected by ERP_SERVICE_TOKEN.
    | Wildcard origins ('*') are strictly disallowed. Direct public browser
    | access to transactional ERP endpoints is forbidden.
    |
    */

    'paths' => ['api/health', 'api/ready'],

    'allowed_methods' => ['GET'],

    'allowed_origins' => array_filter(explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Content-Type', 'X-Requested-With', 'Authorization'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
