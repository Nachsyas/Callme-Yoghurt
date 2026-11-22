<?php

declare(strict_types=1);

namespace App\Http\Controllers\Internal\Admin;

use App\Application\Admin\Order\AdminOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class AdminOrderController extends Controller
{
    public function __construct(
        private readonly AdminOrderService $orderService
    ) {}

    /**
     * List persistent PostgreSQL-backed orders for admin console.
     */
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $search = $request->query('search');
        $page = (int) $request->query('page', 1);
        $perPage = (int) $request->query('per_page', 20);

        $result = $this->orderService->listOrders(
            $status !== null ? (string) $status : null,
            $search !== null ? (string) $search : null,
            $page,
            $perPage
        );

        return response()->json([
            'success' => true,
            'orders' => $result['orders'],
            'metrics' => $result['metrics'],
            'pagination' => $result['pagination'],
        ], 200, [
            'Cache-Control' => 'no-store',
        ]);
    }

    /**
     * Retrieve single persistent PostgreSQL-backed order detail.
     */
    public function show(string $id): JsonResponse
    {
        $order = $this->orderService->getOrderDetail($id);

        if ($order === null) {
            return response()->json([
                'error' => 'Pesanan tidak ditemukan',
            ], 404, [
                'Cache-Control' => 'no-store',
            ]);
        }

        return response()->json([
            'success' => true,
            'order' => $order,
        ], 200, [
            'Cache-Control' => 'no-store',
        ]);
    }
}
