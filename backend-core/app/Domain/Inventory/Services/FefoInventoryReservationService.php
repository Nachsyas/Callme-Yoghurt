<?php

declare(strict_types=1);

namespace App\Domain\Inventory\Services;

use App\Domain\Inventory\Enums\ReservationStatus;
use App\Domain\Inventory\Exceptions\InsufficientInventoryException;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\InventoryLot;
use App\Domain\Inventory\Models\StockAllocation;
use App\Domain\Inventory\Models\StockReservation;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Sales\Models\OrderLine;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class FefoInventoryReservationService
{
    /**
     * Reserve sellable inventory for an order line using FEFO lot allocation.
     *
     * Invariants (ADR-0005):
     * - Any service creating stock_allocations MUST first lock relevant inventory_lots
     *   through this authoritative reservation boundary.
     * - Deterministic lot lock order: expiration_date ASC, production_date ASC, received_at ASC, id ASC.
     * - Expiry evaluated in business timezone Asia/Jakarta: expiration_date < business_today is expired.
     * - Undated lots are excluded from finished goods retail allocation.
     * - Availability = ledger on-hand minus active reserved allocations.
     * - Arithmetic executed in PostgreSQL NUMERIC to prevent floating point imprecision.
     * - Whole unit retail checkout semantics.
     * - Insufficient inventory throws InsufficientInventoryException (triggering complete transaction rollback).
     * - SUM(allocations) == reservation.quantity == order_line.quantity.
     *
     * @param OrderLine $orderLine
     * @param Warehouse $warehouse
     * @return StockReservation
     * @throws InsufficientInventoryException
     */
    public function reserveOrderLine(OrderLine $orderLine, Warehouse $warehouse): StockReservation
    {
        $productVariant = $orderLine->productVariant;
        $inventoryItem = $productVariant->inventoryItem;

        if ($inventoryItem === null || !$inventoryItem->active) {
            throw new InsufficientInventoryException(
                "Inventory item for variant [{$productVariant->id}] is inactive or missing."
            );
        }

        $requiredQuantity = (int) $orderLine->quantity;
        if ($requiredQuantity <= 0) {
            throw new InsufficientInventoryException("Required quantity must be greater than zero.");
        }

        // Evaluate expiry in business timezone Asia/Jakarta
        $businessToday = Carbon::now('Asia/Jakarta')->startOfDay()->toDateString();

        // 1. Query and lock eligible lots deterministically
        /** @var \Illuminate\Database\Eloquent\Collection<int, InventoryLot> $eligibleLots */
        $eligibleLots = InventoryLot::query()
            ->where('inventory_item_id', $inventoryItem->id)
            ->whereNotNull('expiration_date')
            ->where('expiration_date', '>=', $businessToday)
            ->orderBy('expiration_date', 'asc')
            ->orderBy('production_date', 'asc')
            ->orderBy('received_at', 'asc')
            ->orderBy('id', 'asc')
            ->lockForUpdate()
            ->get();

        $remainingToAllocate = $requiredQuantity;
        $allocationsToCreate = [];

        // 2. Derive available whole units per lot via PostgreSQL numeric arithmetic
        foreach ($eligibleLots as $lot) {
            if ($remainingToAllocate <= 0) {
                break;
            }

            $availableUnits = $this->calculateLotAvailableUnits(
                $inventoryItem->id,
                $warehouse->id,
                $lot->id
            );

            if ($availableUnits <= 0) {
                continue;
            }

            $allocateUnits = min($remainingToAllocate, $availableUnits);
            $allocationsToCreate[] = [
                'lot_id' => $lot->id,
                'quantity' => $allocateUnits,
            ];

            $remainingToAllocate -= $allocateUnits;
        }

        // 3. If remaining quantity cannot be satisfied, fail closed
        if ($remainingToAllocate > 0) {
            throw new InsufficientInventoryException(
                "Insufficient inventory available for variant [{$productVariant->id}] in warehouse [{$warehouse->code}]."
            );
        }

        // 4. Create StockReservation
        $reservation = StockReservation::create([
            'inventory_item_id' => $inventoryItem->id,
            'warehouse_id' => $warehouse->id,
            'reference_type' => 'ORDER_LINE',
            'reference_id' => (string) $orderLine->id,
            'quantity' => $requiredQuantity,
            'status' => ReservationStatus::RESERVED->value,
            'expires_at' => null,
        ]);

        // 5. Create StockAllocations
        $totalAllocated = 0;
        foreach ($allocationsToCreate as $alloc) {
            StockAllocation::create([
                'stock_reservation_id' => $reservation->id,
                'inventory_lot_id' => $alloc['lot_id'],
                'quantity' => $alloc['quantity'],
            ]);
            $totalAllocated += $alloc['quantity'];
        }

        // 6. Assert mathematical invariant
        if ($totalAllocated !== $requiredQuantity) {
            throw new InsufficientInventoryException(
                "Allocation sum [{$totalAllocated}] does not match required quantity [{$requiredQuantity}]."
            );
        }

        return $reservation;
    }

    /**
     * Calculate available whole units for a lot in PostgreSQL NUMERIC arithmetic.
     *
     * Invariants:
     * - On-hand = SUM(stock_ledger_entries.quantity_delta)
     * - Active reserved = SUM(stock_allocations.quantity) for reservations WHERE:
     *     warehouse_id matches AND status = 'RESERVED' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
     * - Floor to whole units; negative clamped to zero.
     */
    public function calculateLotAvailableUnits(
        string $inventoryItemId,
        string $warehouseId,
        string $lotId
    ): int {
        $result = DB::selectOne(
            "SELECT FLOOR(GREATEST(0,
                COALESCE((
                    SELECT SUM(quantity_delta)
                    FROM stock_ledger_entries
                    WHERE inventory_item_id = :item_id
                      AND warehouse_id = :warehouse_id
                      AND inventory_lot_id = :lot_id
                ), 0)
                -
                COALESCE((
                    SELECT SUM(sa.quantity)
                    FROM stock_allocations sa
                    JOIN stock_reservations sr ON sr.id = sa.stock_reservation_id
                    WHERE sa.inventory_lot_id = :lot_id_alloc
                      AND sr.warehouse_id = :warehouse_id_alloc
                      AND sr.status = 'RESERVED'
                      AND (sr.expires_at IS NULL OR sr.expires_at > CURRENT_TIMESTAMP)
                ), 0)
            ))::bigint AS available_units",
            [
                'item_id' => $inventoryItemId,
                'warehouse_id' => $warehouseId,
                'lot_id' => $lotId,
                'lot_id_alloc' => $lotId,
                'warehouse_id_alloc' => $warehouseId,
            ]
        );

        return (int) ($result->available_units ?? 0);
    }
}
