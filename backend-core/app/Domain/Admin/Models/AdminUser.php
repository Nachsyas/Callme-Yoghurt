<?php

declare(strict_types=1);

namespace App\Domain\Admin\Models;

use App\Domain\Admin\Enums\AdminRole;
use App\Domain\Admin\Enums\AdminStatus;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Hash;

class AdminUser extends Model
{
    use HasUuids;

    protected $table = 'admin_users';

    protected $fillable = [
        'name',
        'email',
        'password_hash',
        'role',
        'status',
        'last_login_at',
        'failed_login_attempts',
        'locked_until',
    ];

    /**
     * Hidden attributes. Password hashes must NEVER be exposed in JSON/array serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password_hash',
    ];

    protected function casts(): array
    {
        return [
            'role' => AdminRole::class,
            'status' => AdminStatus::class,
            'last_login_at' => 'datetime',
            'locked_until' => 'datetime',
            'failed_login_attempts' => 'integer',
        ];
    }

    /**
     * Always normalize email to lowercase and trimmed before persistence.
     */
    public function setEmailAttribute(string $value): void
    {
        $this->attributes['email'] = mb_strtolower(trim($value));
    }

    /**
     * Set password hash using Argon2id.
     */
    public function setPassword(string $password): void
    {
        if (trim($password) === '') {
            throw new \InvalidArgumentException('Admin password cannot be empty or whitespace.');
        }

        $this->password_hash = Hash::driver('argon2id')->make($password);
    }

    /**
     * Timing-safe verification of plaintext password against stored hash.
     */
    public function verifyPassword(string $password): bool
    {
        if (empty($this->password_hash) || empty($password)) {
            return false;
        }

        try {
            return Hash::driver('argon2id')->check($password, $this->password_hash);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Check whether account is currently temporarily locked.
     */
    public function isLocked(): bool
    {
        return $this->locked_until !== null && $this->locked_until->isFuture();
    }

    /**
     * Register a failed login attempt and temporarily lock account if threshold reached.
     */
    public function incrementFailedAttempts(int $maxAttempts = 5, int $lockMinutes = 15): void
    {
        $this->failed_login_attempts = ($this->failed_login_attempts ?? 0) + 1;

        if ($this->failed_login_attempts >= $maxAttempts) {
            $this->locked_until = Carbon::now()->addMinutes($lockMinutes);
        }

        $this->save();
    }

    /**
     * Record successful login: update last_login_at and reset failure counters.
     */
    public function recordSuccessfulLogin(): void
    {
        $this->last_login_at = Carbon::now();
        $this->failed_login_attempts = 0;
        $this->locked_until = null;
        $this->save();
    }

    /**
     * Manually unlock account.
     */
    public function unlock(): void
    {
        $this->failed_login_attempts = 0;
        $this->locked_until = null;
        $this->save();
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(AdminAuditLog::class, 'admin_user_id');
    }
}
