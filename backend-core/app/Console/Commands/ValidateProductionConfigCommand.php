<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Domain\Security\Services\ProductionConfigValidator;
use Illuminate\Console\Command;

class ValidateProductionConfigCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'callme:validate-production-config
                            {--strict : Enforce production requirements regardless of current APP_ENV}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Validate security-critical production configuration without leaking secrets';

    /**
     * Execute the console command.
     */
    public function handle(ProductionConfigValidator $validator): int
    {
        $strict = (bool) $this->option('strict');
        $this->info('==> [Callme ERP] Auditing production configuration readiness...');

        $result = $validator->validate($strict);

        $this->newLine();
        $this->info('Configuration Audit Summary:');
        $headers = ['Variable / Component', 'Status'];
        $rows = [];
        foreach ($result['audited'] as $key => $status) {
            $rows[] = [$key, $status];
        }
        $this->table($headers, $rows);

        if (!empty($result['warnings'])) {
            $this->newLine();
            $this->warn('Operational / Business Configuration Warnings:');
            foreach ($result['warnings'] as $key => $warning) {
                $this->warn("  [WARN] {$key}: {$warning}");
            }
        }

        if (!$result['passed']) {
            $this->newLine();
            $this->error('CRITICAL: Production configuration validation FAILED with the following errors:');
            foreach ($result['errors'] as $key => $error) {
                $this->error("  [FAIL] {$key}: {$error}");
            }
            $this->newLine();
            $this->error('Aborting deployment sequence. Failing closed to prevent insecure operation.');

            return Command::FAILURE;
        }

        $this->newLine();
        $this->info('==> [Callme ERP] All security-critical configuration checks PASSED.');

        return Command::SUCCESS;
    }
}
