<?php

declare(strict_types=1);

namespace App\Domain\CRM\Models;

use App\Domain\CRM\Services\PhoneBlindIndexService;
use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $table = 'customers';

    protected $fillable = [
        'name',
        'phone',
        'address',
        'phone_bindex',
    ];

    /**
     * Attributes hidden from array/JSON serialization.
     * Note: This provides serialization protection; structured application
     * logging must still use explicit safe/redacted attributes.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'name',
        'phone',
        'address',
        'phone_bindex',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'name' => 'encrypted',
            'phone' => 'encrypted',
            'address' => 'encrypted',
        ];
    }

    /**
     * Set the phone attribute and calculate its blind index via the dedicated service.
     */
    public function setPhoneWithBlindIndex(string $phone, ?string $secretKey = null): void
    {
        $this->phone = $phone;
        $this->phone_bindex = PhoneBlindIndexService::generateBlindIndex($phone, $secretKey);
    }
}
