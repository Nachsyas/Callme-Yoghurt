<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Checkout Request Fingerprint Secret Key
    |--------------------------------------------------------------------------
    |
    | Secret key used by CreateCheckoutOrderService to compute keyed HMAC-SHA256
    | request fingerprints for idempotent replay protection. There is deliberately
    | no fallback secret; missing configuration fails closed.
    |
    */
    'fingerprint_key' => env('CHECKOUT_FINGERPRINT_KEY'),

];
