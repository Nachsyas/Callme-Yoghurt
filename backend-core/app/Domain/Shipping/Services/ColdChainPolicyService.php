<?php

declare(strict_types=1);

namespace App\Domain\Shipping\Services;

use Carbon\Carbon;
use DateTimeInterface;

class ColdChainPolicyService
{
    public const TIMEZONE = 'Asia/Jakarta';
    public const OPERATING_HOUR_START = 8;
    public const OPERATING_HOUR_END = 17;
    public const JAKARTA_CUTOFF_HOUR = 17;
    public const OUTSIDE_JAKARTA_CUTOFF_HOUR = 14;
    public const MAX_TRANSIT_DAYS = 3;

    public const MANDATORY_STORAGE_WARNING = 'Hanya tahan 3 hari di suhu ruang. Langsung segera masukan kulkas begitu barang diterima (Suhu < 5°C).';
    public const SAFE_HANDLING_DESCRIPTION = 'Penanganan pengiriman mengikuti SOP produk dairy Callme Yoghurt.';

    /**
     * Checks if destination location is within DKI Jakarta.
     *
     * @param array<string, mixed> $destination
     */
    public function isJakarta(array $destination): bool
    {
        $province = strtolower((string) ($destination['province'] ?? ''));
        $city = strtolower((string) ($destination['city'] ?? ''));
        $postalCode = trim((string) ($destination['postal_code'] ?? ($destination['destination_postal_code'] ?? '')));

        if (str_contains($province, 'jakarta') || str_contains($province, 'dki')) {
            return true;
        }

        if (
            str_contains($city, 'jakarta') ||
            str_contains($city, 'jaktim') ||
            str_contains($city, 'jaksel') ||
            str_contains($city, 'jakpus') ||
            str_contains($city, 'jakbar') ||
            str_contains($city, 'jakut')
        ) {
            return true;
        }

        // Jakarta postal codes start with 10xxx, 11xxx, 12xxx, 13xxx, 14xxx
        if (strlen($postalCode) === 5) {
            $prefix = substr($postalCode, 0, 2);
            if (in_array($prefix, ['10', '11', '12', '13', '14'], true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Categorizes service type from raw rate fields.
     *
     * @param array<string, mixed> $rate
     */
    public function categorizeService(array $rate): string
    {
        $serviceType = strtolower((string) ($rate['service_type'] ?? ''));
        $type = strtolower((string) ($rate['type'] ?? ''));
        $serviceCode = strtolower((string) ($rate['courier_service_code'] ?? ''));
        $serviceName = strtolower((string) ($rate['courier_service_name'] ?? ''));

        if (
            $serviceType === 'instant' ||
            $type === 'instant' ||
            str_contains($serviceCode, 'instant') ||
            str_contains($serviceName, 'instant')
        ) {
            return 'instant';
        }

        if (
            $serviceType === 'same_day' ||
            $type === 'same_day' ||
            str_contains($serviceCode, 'same_day') ||
            str_contains($serviceCode, 'sameday') ||
            str_contains($serviceName, 'same day') ||
            str_contains($serviceName, 'sameday')
        ) {
            return 'sameday';
        }

        if (
            $serviceType === 'next_day' ||
            $type === 'next_day' ||
            $serviceCode === 'yes' ||
            $serviceCode === 'ons' ||
            $serviceCode === 'sds' ||
            str_contains($serviceCode, 'next_day') ||
            str_contains($serviceCode, 'nextday') ||
            str_contains($serviceName, 'next day') ||
            str_contains($serviceName, 'overnight') ||
            str_contains($serviceName, 'esok')
        ) {
            return 'nextday';
        }

        if (
            $serviceType === 'regular' ||
            $serviceType === 'standard' ||
            $type === 'regular' ||
            $type === 'standard' ||
            str_contains($serviceCode, 'reg') ||
            str_contains($serviceCode, 'std') ||
            str_contains($serviceName, 'reguler') ||
            str_contains($serviceName, 'regular') ||
            str_contains($serviceName, 'standard')
        ) {
            return 'regular';
        }

        return 'other';
    }

    /**
     * Enforces SOP 01 transit duration limit: product spoils if room temp transit > 3 days.
     * Blocks any service where duration > 3 days.
     *
     * @param array<string, mixed> $rate
     */
    public function isWithinTransitLimit(array $rate): bool
    {
        $duration = strtolower((string) ($rate['duration'] ?? ''));
        $unit = strtolower((string) ($rate['shipment_duration_unit'] ?? ''));
        $range = trim((string) ($rate['shipment_duration_range'] ?? ''));

        // Hours transit is always within limit (< 24 hours)
        if ($unit === 'hours' || str_contains($duration, 'hour') || str_contains($duration, 'jam')) {
            return true;
        }

        if (str_contains($duration, 'same day') || str_contains($duration, 'hari yang sama')) {
            return true;
        }

        // Parse numbers in range (e.g. "1-2", "2-3", "3-5", "4-6")
        if (preg_match_all('/\d+/', $range !== '' ? $range : $duration, $matches)) {
            $numbers = array_map('intval', $matches[0]);
            $maxDays = max($numbers);
            if ($maxDays > self::MAX_TRANSIT_DAYS) {
                return false;
            }
            return true;
        }

        // If unit is days and no numbers found or unclear, fail safe if it hints multi-day > 3
        if (str_contains($duration, '4') || str_contains($duration, '5') || str_contains($duration, '6') || str_contains($duration, '7')) {
            return false;
        }

        return true;
    }

    /**
     * Calculates dispatch window based on SOP 01 Time-Gating rules.
     *
     * SOP 01:
     * - Operating days: Monday-Saturday (08:00–17:00 WIB)
     * - Sunday: Non-operational -> moved to next working day (Monday 08:00 WIB)
     * - Jakarta cutoff: 17:00 WIB
     * - Outside Jakarta cutoff: 14:00 WIB
     * - Orders outside cutoff/operating hours moved to next working dispatch day.
     *
     * @return array{is_same_day_dispatch: bool, dispatch_date: string, dispatch_note: string}
     */
    public function calculateDispatchWindow(bool $isJakarta, ?DateTimeInterface $referenceTime = null): array
    {
        $now = $referenceTime ? Carbon::instance($referenceTime)->setTimezone(self::TIMEZONE) : Carbon::now(self::TIMEZONE);
        $dayOfWeek = $now->dayOfWeekIso; // 1 (Monday) .. 7 (Sunday)
        $hour = $now->hour;
        $cutoffHour = $isJakarta ? self::JAKARTA_CUTOFF_HOUR : self::OUTSIDE_JAKARTA_CUTOFF_HOUR;

        $isSunday = ($dayOfWeek === 7);
        $isWithinOperatingDays = ($dayOfWeek >= 1 && $dayOfWeek <= 6);
        $isBeforeCutoff = ($hour < $cutoffHour);
        $isOperatingHour = ($hour >= self::OPERATING_HOUR_START && $hour < self::OPERATING_HOUR_END);

        if ($isWithinOperatingDays && $isBeforeCutoff) {
            // Eligible for same day dispatch
            $dispatchDate = $now->toDateString();
            $isSameDay = true;
            $dispatchNote = $now->hour < self::OPERATING_HOUR_START
                ? 'Pesanan diterima sebelum jam buka. Pengiriman diproses hari ini mulai pukul 08:00 WIB.'
                : 'Pesanan dalam batas waktu operasional. Pengiriman diproses hari ini.';
        } else {
            // Cutoff passed or Sunday: find next working day (Monday-Saturday)
            $isSameDay = false;
            $nextWorkingDay = $now->copy();
            do {
                $nextWorkingDay->addDay();
            } while ($nextWorkingDay->dayOfWeekIso === 7); // Skip Sunday

            $dispatchDate = $nextWorkingDay->toDateString();
            if ($isSunday) {
                $dispatchNote = 'Pesanan hari Minggu dialihkan ke hari kerja berikutnya (' . $nextWorkingDay->translatedFormat('l, d F Y') . ' mulai 08:00 WIB).';
            } else {
                $cutoffText = $isJakarta ? '17:00 WIB (Area Jakarta)' : '14:00 WIB (Luar Jakarta)';
                $dispatchNote = "Pesanan melewati batas waktu cutoff {$cutoffText}. Pengiriman dialihkan ke hari kerja berikutnya ({$nextWorkingDay->toDateString()}).";
            }
        }

        return [
            'is_same_day_dispatch' => $isSameDay,
            'dispatch_date' => $dispatchDate,
            'dispatch_note' => $dispatchNote,
        ];
    }

    /**
     * Filters raw Biteship rates against SOP 01 rules and prepares sanitized quotes.
     *
     * @param array<int, array<string, mixed>> $rawRates
     * @param array<string, mixed> $destination
     * @return array<int, array<string, mixed>>
     */
    public function filterRates(array $rawRates, array $destination, ?DateTimeInterface $referenceTime = null): array
    {
        $isJakarta = $this->isJakarta($destination);
        $dispatchInfo = $this->calculateDispatchWindow($isJakarta, $referenceTime);
        $compliantQuotes = [];

        foreach ($rawRates as $rate) {
            if (!is_array($rate)) {
                continue;
            }

            $price = (int) ($rate['price'] ?? 0);
            if ($price <= 0) {
                continue; // Reject negative or zero prices
            }

            $courierCode = strtolower((string) ($rate['courier_code'] ?? ''));
            $serviceCode = strtolower((string) ($rate['courier_service_code'] ?? ''));

            // Block cargo / trucking / non-refrigerated slow bulk services
            if (str_contains($serviceCode, 'cargo') || str_contains($serviceCode, 'trucking') || str_contains($courierCode, 'cargo')) {
                continue;
            }

            // 1. Duration check: product tahan 3 hari di suhu ruang. Kurir > 3 hari diblokir kaku.
            if (!$this->isWithinTransitLimit($rate)) {
                continue;
            }

            $category = $this->categorizeService($rate);

            // 2. Service type gating by destination:
            // Jakarta: Instant, Same Day, Next Day, or fast Regular (<= 3 days)
            // Outside Jakarta: Instant, Same Day, Next Day, or fast Regular (<= 3 days)
            // Cargo/Economy (>3 days) already blocked by isWithinTransitLimit.
            if ($category === 'other') {
                continue;
            }

            $compliantQuotes[] = [
                'courier_code' => $courierCode,
                'courier_name' => (string) ($rate['courier_name'] ?? strtoupper($courierCode)),
                'service_code' => $serviceCode,
                'service_name' => (string) ($rate['courier_service_name'] ?? strtoupper($serviceCode)),
                'service_type' => $category,
                'price' => $price,
                'duration' => (string) ($rate['duration'] ?? ''),
                'cold_chain_compliant' => true,
                'description' => self::SAFE_HANDLING_DESCRIPTION,
                'storage_warning' => self::MANDATORY_STORAGE_WARNING,
                'is_same_day_dispatch' => $dispatchInfo['is_same_day_dispatch'],
                'dispatch_date' => $dispatchInfo['dispatch_date'],
                'dispatch_note' => $dispatchInfo['dispatch_note'],
            ];
        }

        // Priority sort: instant -> sameday -> nextday -> regular, then by price ASC
        $priority = ['instant' => 1, 'sameday' => 2, 'nextday' => 3, 'regular' => 4];
        usort($compliantQuotes, function ($a, $b) use ($priority) {
            $prioA = $priority[$a['service_type']] ?? 99;
            $prioB = $priority[$b['service_type']] ?? 99;
            if ($prioA !== $prioB) {
                return $prioA <=> $prioB;
            }
            return $a['price'] <=> $b['price'];
        });

        return $compliantQuotes;
    }
}
