<?php

declare(strict_types=1);

namespace App\Application\Admin\Inventory;

use App\Domain\Admin\Models\AdminAuditLog;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Inventory\Models\InventoryLot;
use App\Domain\Inventory\Models\StockLedgerEntry;
use App\Domain\Inventory\Models\UnitOfMeasure;
use App\Domain\Inventory\Models\Warehouse;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class AdminInventoryService
{
    /**
     * List all inventory items with server-side calculated on-hand, reserved, and available stock.
     */
    public function listItems(): array
    {
        $items = InventoryItem::query()
            ->with(['baseUom'])
            ->orderBy('code', 'asc')
            ->get();

        $stockSummary = $this->calculateItemsStock();

        return [
            'items' => $items->map(function (InventoryItem $item) use ($stockSummary) {
                $stock = $stockSummary[(string) $item->id] ?? [
                    'on_hand' => 0.0,
                    'reserved' => 0.0,
                    'available' => 0.0,
                ];

                return [
                    'id' => (string) $item->id,
                    'code' => (string) $item->code,
                    'name' => (string) $item->name,
                    'type' => $item->type->value,
                    'base_uom_id' => (string) $item->base_uom_id,
                    'base_uom' => $item->baseUom ? [
                        'id' => (string) $item->baseUom->id,
                        'code' => (string) $item->baseUom->code,
                        'name' => (string) $item->baseUom->name,
                        'category' => (string) $item->baseUom->category,
                    ] : null,
                    'lot_tracked' => (bool) $item->lot_tracked,
                    'active' => (bool) $item->active,
                    'stock' => $stock,
                    'created_at' => $item->created_at?->toIso8601String(),
                ];
            })->values()->all(),
        ];
    }

    /**
     * Create a new inventory item.
     */
    public function createItem(array $data, string $adminUserId, ?string $ip = null, ?string $userAgent = null): InventoryItem
    {
        return DB::transaction(function () use ($data, $adminUserId, $ip, $userAgent) {
            $code = strtoupper(trim((string) ($data['code'] ?? '')));
            if ($code === '') {
                throw new InvalidArgumentException('Item code is required.');
            }
            if (InventoryItem::where('code', $code)->exists()) {
                throw new InvalidArgumentException("Item code [{$code}] already exists.");
            }

            $name = trim((string) ($data['name'] ?? ''));
            if ($name === '') {
                throw new InvalidArgumentException('Item name is required.');
            }

            $rawType = strtoupper(trim((string) ($data['type'] ?? '')));
            $type = ItemType::tryFrom($rawType);
            if ($type === null) {
                throw new InvalidArgumentException("Invalid item type [{$rawType}]. Allowed: RAW_MATERIAL, PACKAGING, FINISHED_GOOD.");
            }

            $baseUomId = (string) ($data['base_uom_id'] ?? '');
            if (!UnitOfMeasure::where('id', $baseUomId)->exists()) {
                throw new InvalidArgumentException("UOM [{$baseUomId}] not found.");
            }

            $item = InventoryItem::create([
                'code' => $code,
                'name' => $name,
                'type' => $type,
                'base_uom_id' => $baseUomId,
                'lot_tracked' => (bool) ($data['lot_tracked'] ?? false),
                'active' => (bool) ($data['active'] ?? true),
            ]);

            AdminAuditLog::record(
                'INVENTORY_ITEM_CREATED',
                $adminUserId,
                [
                    'item_id' => $item->id,
                    'code' => $item->code,
                    'name' => $item->name,
                    'type' => $item->type->value,
                ],
                $ip,
                $userAgent
            );

            return $item->load('baseUom');
        });
    }

    /**
     * Update an inventory item.
     */
    public function updateItem(string $id, array $data, string $adminUserId, ?string $ip = null, ?string $userAgent = null): InventoryItem
    {
        return DB::transaction(function () use ($id, $data, $adminUserId, $ip, $userAgent) {
            /** @var InventoryItem $item */
            $item = InventoryItem::lockForUpdate()->findOrFail($id);

            $updates = [];
            if (array_key_exists('code', $data)) {
                $code = strtoupper(trim((string) $data['code']));
                if ($code === '') {
                    throw new InvalidArgumentException('Item code cannot be empty.');
                }
                if (InventoryItem::where('code', $code)->where('id', '!=', $id)->exists()) {
                    throw new InvalidArgumentException("Item code [{$code}] already exists.");
                }
                $updates['code'] = $code;
            }

            if (array_key_exists('name', $data)) {
                $name = trim((string) $data['name']);
                if ($name === '') {
                    throw new InvalidArgumentException('Item name cannot be empty.');
                }
                $updates['name'] = $name;
            }

            if (array_key_exists('type', $data)) {
                $rawType = strtoupper(trim((string) $data['type']));
                $type = ItemType::tryFrom($rawType);
                if ($type === null) {
                    throw new InvalidArgumentException("Invalid item type [{$rawType}].");
                }
                $updates['type'] = $type;
            }

            if (array_key_exists('base_uom_id', $data)) {
                $baseUomId = (string) $data['base_uom_id'];
                if (!UnitOfMeasure::where('id', $baseUomId)->exists()) {
                    throw new InvalidArgumentException("UOM [{$baseUomId}] not found.");
                }
                $updates['base_uom_id'] = $baseUomId;
            }

            if (array_key_exists('lot_tracked', $data)) {
                $updates['lot_tracked'] = (bool) $data['lot_tracked'];
            }

            if (array_key_exists('active', $data)) {
                $updates['active'] = (bool) $data['active'];
            }

            $item->update($updates);

            AdminAuditLog::record(
                'INVENTORY_ITEM_UPDATED',
                $adminUserId,
                [
                    'item_id' => $item->id,
                    'code' => $item->code,
                    'updated_fields' => array_keys($updates),
                ],
                $ip,
                $userAgent
            );

            return $item->fresh('baseUom');
        });
    }

    /**
     * Soft deactivation of inventory item.
     */
    public function deactivateItem(string $id, string $adminUserId, ?string $ip = null, ?string $userAgent = null): InventoryItem
    {
        return DB::transaction(function () use ($id, $adminUserId, $ip, $userAgent) {
            /** @var InventoryItem $item */
            $item = InventoryItem::lockForUpdate()->findOrFail($id);
            $item->update(['active' => false]);

            AdminAuditLog::record(
                'INVENTORY_ITEM_DEACTIVATED',
                $adminUserId,
                ['item_id' => $item->id, 'code' => $item->code],
                $ip,
                $userAgent
            );

            return $item->fresh('baseUom');
        });
    }

    /**
     * List lots with authoritative stock and FEFO status.
     */
    public function listLots(?string $itemId = null): array
    {
        $query = InventoryLot::query()
            ->with(['item.baseUom'])
            ->orderBy('expiration_date', 'asc');

        if ($itemId !== null && $itemId !== '') {
            $query->where('inventory_item_id', $itemId);
        }

        $lots = $query->get();
        $today = Carbon::now('Asia/Jakarta')->startOfDay();

        $lotStockMap = $this->calculateLotsStock();

        return [
            'lots' => $lots->map(function (InventoryLot $lot) use ($today, $lotStockMap) {
                $stock = $lotStockMap[(string) $lot->id] ?? [
                    'on_hand' => 0.0,
                    'reserved' => 0.0,
                    'available' => 0.0,
                    'warehouse_code' => 'WH-MAIN',
                ];

                $daysRemaining = null;
                $fefoStatus = 'No Expiry';

                if ($lot->expiration_date !== null) {
                    $expDate = Carbon::parse($lot->expiration_date, 'Asia/Jakarta')->startOfDay();
                    $daysRemaining = (int) $today->diffInDays($expDate, false);

                    if ($daysRemaining < 0) {
                        $fefoStatus = 'Expired';
                    } elseif ($daysRemaining <= 7) {
                        $fefoStatus = 'Critical';
                    } elseif ($daysRemaining <= 21) {
                        $fefoStatus = 'Near Expiry';
                    } else {
                        $fefoStatus = 'Available';
                    }
                }

                return [
                    'id' => (string) $lot->id,
                    'inventory_item_id' => (string) $lot->inventory_item_id,
                    'item_code' => $lot->item?->code,
                    'item_name' => $lot->item?->name,
                    'lot_number' => (string) $lot->lot_number,
                    'warehouse_code' => $stock['warehouse_code'] ?? 'WH-MAIN',
                    'production_date' => $lot->production_date?->toDateString(),
                    'expiration_date' => $lot->expiration_date?->toDateString(),
                    'received_at' => $lot->received_at?->toIso8601String(),
                    'days_remaining' => $daysRemaining,
                    'fefo_status' => $fefoStatus,
                    'on_hand' => $stock['on_hand'],
                    'reserved' => $stock['reserved'],
                    'available' => $stock['available'],
                ];
            })->values()->all(),
        ];
    }

    /**
     * Stock Receipt Workflow:
     * Appends positive StockLedgerEntry (quantity_delta > 0).
     */
    public function receiveStock(array $data, string $adminUserId, ?string $ip = null, ?string $userAgent = null): StockLedgerEntry
    {
        return DB::transaction(function () use ($data, $adminUserId, $ip, $userAgent) {
            $itemId = (string) ($data['inventory_item_id'] ?? '');
            /** @var InventoryItem $item */
            $item = InventoryItem::lockForUpdate()->findOrFail($itemId);

            $warehouseQuery = Warehouse::lockForUpdate();
            if (!empty($data['warehouse_id'])) {
                if (\Illuminate\Support\Str::isUuid((string) $data['warehouse_id'])) {
                    $warehouseQuery->where('id', $data['warehouse_id']);
                } else {
                    $warehouseQuery->where('code', strtoupper(trim((string) $data['warehouse_id'])));
                }
            } elseif (!empty($data['warehouse_code'])) {
                $warehouseQuery->where('code', strtoupper(trim((string) $data['warehouse_code'])));
            } else {
                $warehouseQuery->where('code', 'WH-MAIN');
            }
            /** @var Warehouse|null $warehouse */
            $warehouse = $warehouseQuery->first();
            if ($warehouse === null) {
                throw new InvalidArgumentException('Warehouse not found.');
            }

            $quantity = (float) ($data['quantity'] ?? $data['quantity_delta'] ?? 0);
            if ($quantity <= 0) {
                throw new InvalidArgumentException('Received quantity must be greater than zero.');
            }

            $lotId = null;
            if ($item->lot_tracked) {
                $lotNumber = strtoupper(trim((string) ($data['lot_number'] ?? '')));
                if ($lotNumber === '') {
                    throw new InvalidArgumentException('Lot number is mandatory for lot-tracked inventory items.');
                }

                $prodDate = !empty($data['production_date']) ? Carbon::parse($data['production_date'])->toDateString() : null;
                $expDate = !empty($data['expiration_date']) ? Carbon::parse($data['expiration_date'])->toDateString() : null;
                $receivedAt = !empty($data['received_at']) ? Carbon::parse($data['received_at']) : Carbon::now();

                /** @var InventoryLot $lot */
                $lot = InventoryLot::firstOrCreate(
                    [
                        'inventory_item_id' => $item->id,
                        'lot_number' => $lotNumber,
                    ],
                    [
                        'production_date' => $prodDate,
                        'expiration_date' => $expDate,
                        'received_at' => $receivedAt,
                    ]
                );
                $lotId = $lot->id;
            }

            $reference = isset($data['reference']) ? trim((string) $data['reference']) : 'MANUAL_RECEIPT';

            $entry = StockLedgerEntry::create([
                'inventory_item_id' => $item->id,
                'warehouse_id' => $warehouse->id,
                'inventory_lot_id' => $lotId,
                'quantity_delta' => $quantity,
                'event_type' => 'STOCK_RECEIPT',
                'reference_type' => 'PURCHASE_RECEIPT',
                'reference_id' => $reference,
                'correlation_id' => (string) Str::uuid(),
                'occurred_at' => Carbon::now(),
            ]);

            AdminAuditLog::record(
                'INVENTORY_STOCK_RECEIVED',
                $adminUserId,
                [
                    'entry_id' => $entry->id,
                    'item_id' => $item->id,
                    'warehouse_id' => $warehouse->id,
                    'inventory_lot_id' => $lotId,
                    'quantity' => $quantity,
                    'reference' => $reference,
                ],
                $ip,
                $userAgent
            );

            return $entry;
        });
    }

    /**
     * Stock Adjustment Workflow:
     * Appends StockLedgerEntry (quantity_delta != 0).
     * Prevents negative stock states when delta < 0.
     */
    public function adjustStock(array $data, string $adminUserId, ?string $ip = null, ?string $userAgent = null): StockLedgerEntry
    {
        return DB::transaction(function () use ($data, $adminUserId, $ip, $userAgent) {
            $itemId = (string) ($data['inventory_item_id'] ?? '');
            /** @var InventoryItem $item */
            $item = InventoryItem::lockForUpdate()->findOrFail($itemId);

            $warehouseQuery = Warehouse::lockForUpdate();
            if (!empty($data['warehouse_id'])) {
                if (\Illuminate\Support\Str::isUuid((string) $data['warehouse_id'])) {
                    $warehouseQuery->where('id', $data['warehouse_id']);
                } else {
                    $warehouseQuery->where('code', strtoupper(trim((string) $data['warehouse_id'])));
                }
            } elseif (!empty($data['warehouse_code'])) {
                $warehouseQuery->where('code', strtoupper(trim((string) $data['warehouse_code'])));
            } else {
                $warehouseQuery->where('code', 'WH-MAIN');
            }
            /** @var Warehouse|null $warehouse */
            $warehouse = $warehouseQuery->first();
            if ($warehouse === null) {
                throw new InvalidArgumentException('Warehouse not found.');
            }

            $delta = (float) ($data['quantity_delta'] ?? $data['quantity'] ?? 0);
            if ($delta == 0.0) {
                throw new InvalidArgumentException('Stock adjustment quantity delta cannot be zero.');
            }

            $lotId = !empty($data['inventory_lot_id']) ? (string) $data['inventory_lot_id'] : null;
            if ($item->lot_tracked && $lotId === null && !empty($data['lot_number'])) {
                $lot = InventoryLot::where('inventory_item_id', $item->id)
                    ->where('lot_number', strtoupper(trim((string) $data['lot_number'])))
                    ->first();
                $lotId = $lot?->id;
            }

            // Check availability if reduction
            if ($delta < 0) {
                $currentAvailable = $this->calculateAvailableQuantity($item->id, $warehouse->id, $lotId);
                if (($currentAvailable + $delta) < 0) {
                    throw new InvalidArgumentException(
                        "Negative adjustment [{$delta}] exceeds available stock [{$currentAvailable}] for item [{$item->code}]."
                    );
                }
            }

            $reference = !empty($data['reference']) ? trim((string) $data['reference']) : 'MANUAL_ADJUSTMENT';
            $reason = !empty($data['reason']) ? trim((string) $data['reason']) : 'Stock count adjustment';

            $entry = StockLedgerEntry::create([
                'inventory_item_id' => $item->id,
                'warehouse_id' => $warehouse->id,
                'inventory_lot_id' => $lotId,
                'quantity_delta' => $delta,
                'event_type' => 'STOCK_ADJUSTMENT',
                'reference_type' => 'MANUAL_ADJUSTMENT',
                'reference_id' => $reference,
                'correlation_id' => (string) Str::uuid(),
                'occurred_at' => Carbon::now(),
            ]);

            AdminAuditLog::record(
                'INVENTORY_STOCK_ADJUSTED',
                $adminUserId,
                [
                    'entry_id' => $entry->id,
                    'item_id' => $item->id,
                    'warehouse_id' => $warehouse->id,
                    'inventory_lot_id' => $lotId,
                    'quantity_delta' => $delta,
                    'reference' => $reference,
                    'reason' => $reason,
                ],
                $ip,
                $userAgent
            );

            return $entry;
        });
    }

    /**
     * List recent immutable ledger entries.
     */
    public function listLedgerEntries(?string $itemId = null, ?string $warehouseId = null, int $limit = 100): array
    {
        $query = StockLedgerEntry::query()
            ->with(['item.baseUom', 'warehouse', 'lot'])
            ->orderBy('occurred_at', 'desc')
            ->limit($limit);

        if ($itemId !== null && $itemId !== '') {
            $query->where('inventory_item_id', $itemId);
        }
        if ($warehouseId !== null && $warehouseId !== '') {
            if (\Illuminate\Support\Str::isUuid($warehouseId)) {
                $query->where('warehouse_id', $warehouseId);
            } else {
                $query->whereHas('warehouse', function ($q) use ($warehouseId) {
                    $q->where('code', strtoupper($warehouseId));
                });
            }
        }

        $entries = $query->get();

        $stockSummary = null;
        if ($itemId !== null && $itemId !== '') {
            $stockSummary = $this->calculateItemsStock()[$itemId] ?? [
                'on_hand' => 0.0,
                'reserved' => 0.0,
                'available' => 0.0,
            ];
        }

        return [
            'entries' => $entries->map(function (StockLedgerEntry $entry) {
                return [
                    'id' => (string) $entry->id,
                    'inventory_item_id' => (string) $entry->inventory_item_id,
                    'item_code' => $entry->item?->code,
                    'item_name' => $entry->item?->name,
                    'warehouse_code' => $entry->warehouse?->code,
                    'lot_number' => $entry->lot?->lot_number,
                    'quantity_delta' => (float) $entry->quantity_delta,
                    'event_type' => (string) $entry->event_type,
                    'reference_type' => $entry->reference_type,
                    'reference_id' => $entry->reference_id,
                    'occurred_at' => $entry->occurred_at?->toIso8601String(),
                ];
            })->values()->all(),
            'stock_summary' => $stockSummary,
        ];
    }

    /**
     * Helper: lookup UOMs.
     */
    public function listUoms(): array
    {
        return [
            'uoms' => UnitOfMeasure::query()->orderBy('name', 'asc')->get()->map(function (UnitOfMeasure $u) {
                return [
                    'id' => (string) $u->id,
                    'code' => (string) $u->code,
                    'name' => (string) $u->name,
                    'category' => (string) $u->category,
                ];
            })->values()->all(),
        ];
    }

    /**
     * Helper: lookup Warehouses.
     */
    public function listWarehouses(): array
    {
        return [
            'warehouses' => Warehouse::query()->where('active', true)->orderBy('code', 'asc')->get()->map(function (Warehouse $w) {
                return [
                    'id' => (string) $w->id,
                    'code' => (string) $w->code,
                    'name' => (string) $w->name,
                ];
            })->values()->all(),
        ];
    }

    /**
     * Calculate on-hand, reserved, and available stock per inventory item across all warehouses.
     */
    private function calculateItemsStock(): array
    {
        $onHandRows = DB::table('stock_ledger_entries')
            ->select('inventory_item_id', DB::raw('SUM(quantity_delta) as total_on_hand'))
            ->groupBy('inventory_item_id')
            ->get();

        $reservedRows = DB::table('stock_allocations as sa')
            ->join('stock_reservations as sr', 'sr.id', '=', 'sa.stock_reservation_id')
            ->where('sr.status', 'RESERVED')
            ->where(function ($q) {
                $q->whereNull('sr.expires_at')->orWhere('sr.expires_at', '>', Carbon::now());
            })
            ->select('sr.inventory_item_id', DB::raw('SUM(sa.quantity) as total_reserved'))
            ->groupBy('sr.inventory_item_id')
            ->get();

        $summary = [];
        foreach ($onHandRows as $row) {
            $itemId = (string) $row->inventory_item_id;
            $onHand = (float) $row->total_on_hand;
            $summary[$itemId] = [
                'on_hand' => $onHand,
                'reserved' => 0.0,
                'available' => max(0.0, $onHand),
            ];
        }

        foreach ($reservedRows as $row) {
            $itemId = (string) $row->inventory_item_id;
            $reserved = (float) $row->total_reserved;
            if (!isset($summary[$itemId])) {
                $summary[$itemId] = ['on_hand' => 0.0, 'reserved' => 0.0, 'available' => 0.0];
            }
            $summary[$itemId]['reserved'] = $reserved;
            $summary[$itemId]['available'] = max(0.0, $summary[$itemId]['on_hand'] - $reserved);
        }

        return $summary;
    }

    /**
     * Calculate on-hand, reserved, and available stock per lot.
     */
    private function calculateLotsStock(): array
    {
        $onHandRows = DB::table('stock_ledger_entries as sle')
            ->join('warehouses as w', 'w.id', '=', 'sle.warehouse_id')
            ->whereNotNull('sle.inventory_lot_id')
            ->select('sle.inventory_lot_id', 'w.code as warehouse_code', DB::raw('SUM(sle.quantity_delta) as lot_on_hand'))
            ->groupBy('sle.inventory_lot_id', 'w.code')
            ->get();

        $reservedRows = DB::table('stock_allocations as sa')
            ->join('stock_reservations as sr', 'sr.id', '=', 'sa.stock_reservation_id')
            ->where('sr.status', 'RESERVED')
            ->where(function ($q) {
                $q->whereNull('sr.expires_at')->orWhere('sr.expires_at', '>', Carbon::now());
            })
            ->select('sa.inventory_lot_id', DB::raw('SUM(sa.quantity) as lot_reserved'))
            ->groupBy('sa.inventory_lot_id')
            ->get();

        $result = [];
        foreach ($onHandRows as $row) {
            $lotId = (string) $row->inventory_lot_id;
            $onHand = (float) $row->lot_on_hand;
            $result[$lotId] = [
                'on_hand' => $onHand,
                'reserved' => 0.0,
                'available' => max(0.0, $onHand),
                'warehouse_code' => (string) $row->warehouse_code,
            ];
        }

        foreach ($reservedRows as $row) {
            $lotId = (string) $row->inventory_lot_id;
            $reserved = (float) $row->lot_reserved;
            if (!isset($result[$lotId])) {
                $result[$lotId] = [
                    'on_hand' => 0.0,
                    'reserved' => 0.0,
                    'available' => 0.0,
                    'warehouse_code' => 'WH-MAIN',
                ];
            }
            $result[$lotId]['reserved'] = $reserved;
            $result[$lotId]['available'] = max(0.0, $result[$lotId]['on_hand'] - $reserved);
        }

        return $result;
    }

    /**
     * Compute available quantity for a specific item, warehouse, and optional lot.
     */
    private function calculateAvailableQuantity(string $itemId, string $warehouseId, ?string $lotId = null): float
    {
        $onHandQuery = DB::table('stock_ledger_entries')
            ->where('inventory_item_id', $itemId)
            ->where('warehouse_id', $warehouseId);

        if ($lotId !== null) {
            $onHandQuery->where('inventory_lot_id', $lotId);
        }

        $onHand = (float) ($onHandQuery->sum('quantity_delta') ?? 0.0);

        $reservedQuery = DB::table('stock_allocations as sa')
            ->join('stock_reservations as sr', 'sr.id', '=', 'sa.stock_reservation_id')
            ->where('sr.inventory_item_id', $itemId)
            ->where('sr.warehouse_id', $warehouseId)
            ->where('sr.status', 'RESERVED')
            ->where(function ($q) {
                $q->whereNull('sr.expires_at')->orWhere('sr.expires_at', '>', Carbon::now());
            });

        if ($lotId !== null) {
            $reservedQuery->where('sa.inventory_lot_id', $lotId);
        }

        $reserved = (float) ($reservedQuery->sum('sa.quantity') ?? 0.0);

        return max(0.0, $onHand - $reserved);
    }
}
