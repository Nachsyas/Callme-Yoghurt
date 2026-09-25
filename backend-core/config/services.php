<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Internal Service Authentication
    |--------------------------------------------------------------------------
    |
    | Shared secret token used by the Next.js BFF to authenticate requests
    | against internal ERP endpoints (e.g. /api/internal/*).
    | When unconfigured, internal service authentication fails closed.
    |
    */
    'internal' => [
        'service_token' => env('ERP_SERVICE_TOKEN'),
    ],

];
