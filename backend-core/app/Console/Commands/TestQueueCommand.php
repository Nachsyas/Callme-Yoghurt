<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\VerifyQueueProcessingJob;
use Illuminate\Console\Command;

class TestQueueCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'callme:test-queue {message=Verification ping}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Dispatch a test job to the Redis queue for worker verification';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $message = (string) $this->argument('message');
        
        $this->info("Dispatching VerifyQueueProcessingJob to Redis queue...");
        VerifyQueueProcessingJob::dispatch($message);
        $this->info("Job dispatched successfully to queue: " . config('queue.default'));

        return self::SUCCESS;
    }
}
