<?php

declare(strict_types=1);

namespace App\Http\Controllers\Internal\Admin;

use App\Application\Admin\Inventory\AdminInventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use InvalidArgumentException;
use Throwable;

class AdminInventoryController extends Controller
{
    public function __construct(
        private readonly AdminInventoryService $inventoryService
    ) {}

    public function indexItems(): JsonResponse
    {
        return response()->json($this->inventoryService->listItems());
    }

    public function storeItem(Request $request): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        try {
            $item = $this->inventoryService->createItem(
                $request->all(),
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Inventory item created successfully',
                'item' => $item,
            ], 201);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to create inventory item: ' . $e->getMessage()], 500);
        }
    }

    public function updateItem(Request $request, string $id): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        try {
            $item = $this->inventoryService->updateItem(
                $id,
                $request->all(),
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Inventory item updated successfully',
                'item' => $item,
            ]);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to update inventory item: ' . $e->getMessage()], 500);
        }
    }

    public function deactivateItem(Request $request, string $id): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        try {
            $item = $this->inventoryService->deactivateItem(
                $id,
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Inventory item deactivated successfully',
                'item' => $item,
            ]);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to deactivate inventory item: ' . $e->getMessage()], 500);
        }
    }

    public function indexLots(Request $request): JsonResponse
    {
        $itemId = $request->query('item_id');
        return response()->json($this->inventoryService->listLots($itemId ? (string) $itemId : null));
    }

    public function receiveStock(Request $request): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        try {
            $entry = $this->inventoryService->receiveStock(
                $request->all(),
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Stock received successfully',
                'entry' => $entry,
            ], 201);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to receive stock: ' . $e->getMessage()], 500);
        }
    }

    public function adjustStock(Request $request): JsonResponse
    {
        $adminUserId = (string) $request->header('X-Admin-User-Id');

        try {
            $entry = $this->inventoryService->adjustStock(
                $request->all(),
                $adminUserId,
                $request->ip(),
                $request->userAgent()
            );

            return response()->json([
                'message' => 'Stock adjusted successfully',
                'entry' => $entry,
            ], 201);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (Throwable $e) {
            return response()->json(['error' => 'Failed to adjust stock: ' . $e->getMessage()], 500);
        }
    }

    public function indexLedger(Request $request): JsonResponse
    {
        $itemId = $request->query('inventory_item_id') ?? $request->query('item_id');
        $warehouseId = $request->query('warehouse_id') ?? $request->query('warehouse_code');
        $limit = $request->query('limit', 100);

        return response()->json($this->inventoryService->listLedgerEntries(
            $itemId ? (string) $itemId : null,
            $warehouseId ? (string) $warehouseId : null,
            (int) $limit
        ));
    }

    public function indexMeta(): JsonResponse
    {
        return response()->json([
            'uoms' => $this->inventoryService->listUoms()['uoms'],
            'warehouses' => $this->inventoryService->listWarehouses()['warehouses'],
            'inventory_items' => $this->inventoryService->listItems()['items'],
        ]);
    }
}
