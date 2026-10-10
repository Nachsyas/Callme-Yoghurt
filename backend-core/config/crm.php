<?php

return [

    /*
    |--------------------------------------------------------------------------
    | CRM PII Blind Index Key
    |--------------------------------------------------------------------------
    |
    | Used by PhoneBlindIndexService to compute deterministic HMAC-SHA256
    | hashes for searchable encrypted PII lookup. There is deliberately no
    | hardcoded fallback secret; when unconfigured, generation fails closed.
    |
    */
    'pii_blind_index_key' => env('CRM_PII_BLIND_INDEX_KEY'),

];
