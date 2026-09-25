<?php

declare(strict_types=1);

namespace App\Providers;

use App\Domain\Storage\Contracts\ObjectStorageProviderInterface;
use App\Domain\Storage\Services\ObjectUploadService;
use App\Domain\Storage\Services\S3ObjectStorageProvider;
use Illuminate\Contracts\Filesystem\Factory as FilesystemFactory;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(ObjectStorageProviderInterface::class, function ($app) {
            $isProduction = $app->environment("production");

            return new S3ObjectStorageProvider(
                filesystem: $app->make(FilesystemFactory::class),
                diskName: "object",
                isProduction: $isProduction,
            );
        });

        $this->app->singleton(ObjectUploadService::class, function ($app) {
            return new ObjectUploadService(
                storageProvider: $app->make(ObjectStorageProviderInterface::class),
                diskName: "object",
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
