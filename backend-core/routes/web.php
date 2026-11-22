<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'service' => 'Callme Yoghurt ERP Core',
        'status' => 'operational',
    ]);
});
