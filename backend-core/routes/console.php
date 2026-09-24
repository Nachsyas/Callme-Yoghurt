<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('callme:test-queue {msg=Phase 1.7 Queue Verification}', function (string $msg = 'Phase 1.7 Queue Verification') {
    $this->info("Dispatching test job to Redis queue: {$msg}");
    \App\Jobs\VerifyQueueProcessingJob::dispatch($msg);
    $this->info("Job dispatched successfully to queue: " . config('queue.default'));
})->purpose('Dispatch a test job to the Redis queue for worker verification');
