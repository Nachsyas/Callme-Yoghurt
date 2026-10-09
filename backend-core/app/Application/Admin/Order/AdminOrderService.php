<?php

declare(strict_types=1);

namespace App\Application\Admin\Order;

use App\Domain\Inventory\Models\StockReservation;
use App\Domain\Sales\Enums\OrderStatus;
use App\Domain\Sales\Models\Order;
use Carbon\Carbon;

class AdminOrderService
{
    /**
     * List sanitized admin orders with optional status and search filters,
     * bounded server-side pagination, batch reservation lookup, and accounting metrics.
     *
     * Invariants (Phase 1.7C.20, 1.7C.22A, 1.7C.22A.1):
     * - Derives strictly from PostgreSQL database via Laravel Order domain.
     * - Never fabricates synthetic seed orders.
     * - Bounded pagination (max 100 per page, default 20) with deterministic sorting.
     * - Eliminates N+1 queries by batch-loading StockReservation records.
     * - Accurate payment metric accounting: unverified payment includes all unverified orders (CONFIRMED + DONE).
     * - Multi-line inventory reservation aggregation: truthful status derivation per order item and aggregated ledger.
     *
     * @return array{orders: array<int, array<string, mixed>>, metrics: array<string, mixed>, pagination: array<string, int>}
     */
    public function listOrders(?string $status = null, ?string $search = null, int $page = 1, int $perPage = 20): array
    {
        // Enforce safe pagination bounds
        $page = max(1, $page);
        $perPage = min(100, max(1, $perPage));

        $query = Order::with(['lines.productVariant.product', 'customer'])
            ->orderBy('created_at', 'desc')
            ->orderBy('id', 'desc');

        if ($status !== null && $status !== '' && $status !== 'ALL') {
            $mappedStatus = $this->mapFrontendStatusToOrderStatus($status);
            if ($mappedStatus !== null) {
                $query->where('status', $mappedStatus);
            }
        }

        if ($search !== null && trim($search) !== '') {
            $searchTerm = trim($search);
            $query->where(function ($q) use ($searchTerm) {
                $q->where('order_number', 'ILIKE', "%{$searchTerm}%");
            });
        }

        // Dedicated total count for pagination metadata
        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));

        $orders = $query->forPage($page, $perPage)->get();

        // Batch pre-fetch all StockReservation records to eliminate N+1 queries
        $allLineIds = [];
        $allOrderIds = [];
        foreach ($orders as $order) {
            $allOrderIds[] = (string) $order->id;
            foreach ($order->lines as $line) {
                $allLineIds[] = (string) $line->id;
            }
        }

        $reservationsByLineId = [];
        $reservationsByOrderId = [];

        if (!empty($allLineIds)) {
            $lineReservations = StockReservation::where('reference_type', 'ORDER_LINE')
                ->whereIn('reference_id', $allLineIds)
                ->get();
            foreach ($lineReservations as $res) {
                $reservationsByLineId[(string) $res->reference_id][] = $res;
            }
        }

        if (!empty($allOrderIds)) {
            $orderReservations = StockReservation::where('reference_type', 'ORDER')
                ->whereIn('reference_id', $allOrderIds)
                ->get();
            foreach ($orderReservations as $res) {
                $reservationsByOrderId[(string) $res->reference_id][] = $res;
            }
        }

        $sanitizedOrders = [];
        foreach ($orders as $order) {
            $sanitizedOrders[] = $this->mapOrderToDto($order, $reservationsByLineId, $reservationsByOrderId);
        }

        $metrics = $this->calculateMetrics();

        return [
            'orders' => $sanitizedOrders,
            'metrics' => $metrics,
            'pagination' => [
                'current_page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $lastPage,
            ],
        ];
    }

    /**
     * Retrieve single sanitized admin order detail by ID or order_number.
     *
     * @return array<string, mixed>|null
     */
    public function getOrderDetail(string $id): ?array
    {
        $query = Order::with(['lines.productVariant.product', 'customer']);

        if (\Illuminate\Support\Str::isUuid($id)) {
            $query->where('id', $id);
        } else {
            $query->where('order_number', $id);
        }

        $order = $query->first();

        if ($order === null) {
            return null;
        }

        // Fetch reservations for this single order
        $lineIds = $order->lines->pluck('id')->map(fn ($lid) => (string) $lid)->all();
        $reservationsByLineId = [];
        $reservationsByOrderId = [];

        if (!empty($lineIds)) {
            $lineReservations = StockReservation::where('reference_type', 'ORDER_LINE')
                ->whereIn('reference_id', $lineIds)
                ->get();
            foreach ($lineReservations as $res) {
                $reservationsByLineId[(string) $res->reference_id][] = $res;
            }
        }

        $orderReservations = StockReservation::where('reference_type', 'ORDER')
            ->where('reference_id', (string) $order->id)
            ->get();
        foreach ($orderReservations as $res) {
            $reservationsByOrderId[(string) $res->reference_id][] = $res;
        }

        return $this->mapOrderToDto($order, $reservationsByLineId, $reservationsByOrderId);
    }

    /**
     * Map Eloquent Order model to sanitized AdminOrderRecord DTO with multi-line reservation aggregation.
     *
     * @param array<string, array<int, StockReservation>> $reservationsByLineId
     * @param array<string, array<int, StockReservation>> $reservationsByOrderId
     * @return array<string, mixed>
     */
    public function mapOrderToDto(
        Order $order,
        array $reservationsByLineId = [],
        array $reservationsByOrderId = []
    ): array {
        $items = [];
        $inventoryItems = [];
        $lineStatuses = [];
        $reservationIds = [];

        foreach ($order->lines as $line) {
            $variant = $line->productVariant;
            $product = $variant?->product;
            $lineId = (string) $line->id;

            $items[] = [
                'product_name' => $product?->name ?? 'Callme Yoghurt',
                'variant' => $variant?->variant_name ?? ($variant?->sku ?? 'Standard'),
                'quantity' => (int) $line->quantity,
                'price' => (int) $line->unit_price,
            ];

            // Resolve authoritative line-level reservation
            $lineRes = $reservationsByLineId[$lineId][0] ?? null;
            if ($lineRes === null && !empty($reservationsByOrderId[(string) $order->id])) {
                $lineRes = $reservationsByOrderId[(string) $order->id][0];
            }

            if ($lineRes !== null) {
                $status = (string) $lineRes->status;
                $resQty = (int) $lineRes->quantity;
                $reservationIds[] = (string) $lineRes->id;
            } else {
                $status = 'PENDING';
                $resQty = 0;
            }

            $lineStatuses[] = $status;

            $inventoryItems[] = [
                'product_name' => $product?->name ?? 'Callme Yoghurt',
                'variant' => $variant?->variant_name ?? ($variant?->sku ?? 'Standard'),
                'quantity' => (int) $line->quantity,
                'available_stock' => null, // Authoritative item available stock is not fabricated
                'reserved_quantity' => $resQty,
                'status' => $status,
            ];
        }

        $frontendStatus = $this->mapOrderStatusToFrontend($order->status);

        // Multi-line inventory reservation aggregation (Phase 1.7C.22A.1 Section 9)
        if ($order->lines->isEmpty()) {
            $orderRes = $reservationsByOrderId[(string) $order->id][0] ?? null;
            if ($orderRes !== null) {
                $aggregateStatus = (string) $orderRes->status;
                $aggregateSummary = $aggregateStatus === 'RESERVED' ? 'READY' : $aggregateStatus;
                $reservationIds[] = (string) $orderRes->id;
            } else {
                $aggregateStatus = 'PENDING';
                $aggregateSummary = 'PENDING';
            }
        } else {
            $uniqueStatuses = array_values(array_unique($lineStatuses));
            if (count($uniqueStatuses) === 1) {
                $soleStatus = $uniqueStatuses[0];
                $aggregateStatus = $soleStatus;
                $aggregateSummary = $soleStatus === 'RESERVED' ? 'READY' : $soleStatus;
            } else {
                $hasReservedOrFulfilled = in_array('RESERVED', $uniqueStatuses, true) || in_array('FULFILLED', $uniqueStatuses, true);
                if ($hasReservedOrFulfilled) {
                    $aggregateStatus = 'PARTIAL';
                    $aggregateSummary = 'PARTIAL';
                } else {
                    $aggregateStatus = 'PENDING';
                    $aggregateSummary = 'PENDING';
                }
            }
        }

        $reservationIdStr = !empty($reservationIds) ? implode(', ', array_unique($reservationIds)) : '';

        return [
            'id' => (string) $order->id,
            'order_number' => $order->order_number,
            'order_date' => $order->created_at?->toIso8601String() ?? Carbon::now()->toIso8601String(),
            'customer' => [
                'name' => $order->shipping_name ?? ($order->customer?->name ?? 'Pelanggan'),
                'whatsapp' => $order->shipping_phone ?? ($order->customer?->phone ?? '-'),
                'address' => $order->shipping_address ?? '-',
            ],
            'items' => $items,
            'cost' => [
                'subtotal' => (int) $order->subtotal_amount,
                'shipping_fee' => (int) $order->shipping_fee,
                'cold_chain_fee' => 0,
                'service_fee' => (int) $order->service_fee,
                'total_amount' => (int) $order->total_amount,
            ],
            'payment' => [
                'method' => 'QRIS Manual',
                // In Manual QRIS without payment settlement verification records,
                // OrderStatus::DONE must NOT imply PAID. Remains PENDING_PAYMENT unless cancelled.
                'status' => $order->status === OrderStatus::CANCELLED ? 'CANCELLED' : 'PENDING_PAYMENT',
                'proof_status' => 'waiting_verification',
            ],
            'order_status' => $frontendStatus,
            'delivery_method' => $order->shipping_courier
                ? trim("{$order->shipping_courier} {$order->shipping_service}")
                : ($order->delivery_method?->value ?? 'Next Day'),
            'inventory' => [
                'reservation_id' => $reservationIdStr,
                'status' => $aggregateStatus,
                'summary_status' => $aggregateSummary,
                'items' => $inventoryItems,
            ],
            'audit_logs' => [],
            'notifications' => [],
            'created_at' => $order->created_at?->toIso8601String() ?? Carbon::now()->toIso8601String(),
            'updated_at' => $order->updated_at?->toIso8601String() ?? Carbon::now()->toIso8601String(),
        ];
    }

    /**
     * Map frontend OrderLifecycleStatus to backend OrderStatus enum.
     */
    private function mapFrontendStatusToOrderStatus(string $status): ?OrderStatus
    {
        return match ($status) {
            'WAITING_PAYMENT', 'PAYMENT_CONFIRMED', 'PROCESSING', 'READY_TO_SHIP' => OrderStatus::CONFIRMED,
            'COMPLETED', 'DELIVERED' => OrderStatus::DONE,
            'CANCELLED' => OrderStatus::CANCELLED,
            default => null,
        };
    }

    /**
     * Map backend OrderStatus enum to frontend OrderLifecycleStatus string.
     */
    private function mapOrderStatusToFrontend(OrderStatus $status): string
    {
        return match ($status) {
            OrderStatus::DRAFT, OrderStatus::CONFIRMED => 'WAITING_PAYMENT',
            OrderStatus::DONE => 'COMPLETED',
            OrderStatus::CANCELLED => 'CANCELLED',
        };
    }

    /**
     * Calculate summary KPI metrics from PostgreSQL orders table.
     *
     * Metric Accounting Invariants (Phase 1.7C.22A.1 Section 8):
     * - today_orders: Orders created since midnight today.
     * - waiting_payment: Orders confirmed pending verification.
     * - completed_orders: Orders marked as DONE in ERP lifecycle.
     * - cancelled_orders: Orders voided or cancelled.
     * - gross_order_value (GOV): Total monetary sum of all valid active/completed orders (CONFIRMED + DONE).
     * - unverified_payment_value: Outstanding monetary sum for all unverified orders (CONFIRMED + DONE).
     * - pending_payments_value: Mirrors unverified_payment_value for backward compatibility.
     * - verified_payment_value: Explicit 0 (No verified settlement ledger exists in Manual QRIS mode).
     * - settled_revenue: Explicit 0 (Merchant settlement unverified).
     * - recognized_revenue: Explicit 0 (Delivery & settlement unverified).
     * - total_revenue: Gross Order Value (retained for backward compatibility).
     *
     * @return array<string, mixed>
     */
    private function calculateMetrics(): array
    {
        $today = Carbon::today();

        $todayOrders = Order::where('created_at', '>=', $today)->count();
        $waitingPayment = Order::where('status', OrderStatus::CONFIRMED)->count();
        $completedOrders = Order::where('status', OrderStatus::DONE)->count();
        $cancelledOrders = Order::where('status', OrderStatus::CANCELLED)->count();

        // Gross Order Value: Sum of confirmed and completed orders
        $grossOrderValue = (int) Order::whereIn('status', [OrderStatus::CONFIRMED, OrderStatus::DONE])
            ->sum('total_amount');

        // Unverified Payment Value: In Manual QRIS without settlement verification,
        // BOTH CONFIRMED and DONE orders remain PENDING_PAYMENT.
        $unverifiedPaymentValue = (int) Order::whereIn('status', [OrderStatus::CONFIRMED, OrderStatus::DONE])
            ->sum('total_amount');

        // Preserves API compatibility with frontend expectation
        $pendingPaymentsValue = $unverifiedPaymentValue;

        return [
            'today_orders' => $todayOrders,
            'waiting_payment' => $waitingPayment,
            'processing' => 0,
            'ready_to_ship' => 0,
            'completed_orders' => $completedOrders,
            'cancelled_orders' => $cancelledOrders,
            'gross_order_value' => $grossOrderValue,
            'pending_payments_value' => $pendingPaymentsValue,
            'unverified_payment_value' => $unverifiedPaymentValue,
            'verified_payment_value' => 0,
            'settled_revenue' => 0,
            'recognized_revenue' => 0,
            'total_revenue' => $grossOrderValue,
        ];
    }
}
