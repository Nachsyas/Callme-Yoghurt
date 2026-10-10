<?php

declare(strict_types=1);

namespace App\Domain\Admin\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AdminAuditLog extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected $table = 'admin_audit_logs';

    protected $fillable = [
        'admin_user_id',
        'action',
        'ip_address',
        'user_agent',
        'metadata',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function adminUser(): BelongsTo
    {
        return $this->belongsTo(AdminUser::class, 'admin_user_id');
    }

    /**
     * Record an audit log entry.
     * Enforces that passwords, hashes, and tokens are never persisted in metadata.
     */
    public static function record(
        string $action,
        ?string $adminUserId = null,
        ?array $metadata = null,
        ?string $ipAddress = null,
        ?string $userAgent = null
    ): self {
        // Redact any accidentally supplied sensitive fields from metadata
        $safeMetadata = $metadata ?? [];
        unset(
            $safeMetadata['password'],
            $safeMetadata['password_hash'],
            $safeMetadata['token'],
            $safeMetadata['secret'],
            $safeMetadata['authorization']
        );

        return self::create([
            'admin_user_id' => $adminUserId,
            'action' => $action,
            'ip_address' => $ipAddress ? substr($ipAddress, 0, 45) : null,
            'user_agent' => $userAgent ? substr($userAgent, 0, 1000) : null,
            'metadata' => empty($safeMetadata) ? null : $safeMetadata,
            'created_at' => Carbon::now(),
        ]);
    }
}
