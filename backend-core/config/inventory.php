<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Fulfillment Warehouse Code
    |--------------------------------------------------------------------------
    |
    | Authoritative warehouse code used for retail checkout inventory reservation
    | and FEFO lot allocation. There is deliberately no fallback default;
    | missing configuration fails closed.
    |
    */
    'fulfillment_warehouse_code' => env('ERP_FULFILLMENT_WAREHOUSE_CODE'),

];
