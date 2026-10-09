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
     * List sanitized admin orders with optional status and search filters.
     *
     * Invariants (Phase 1.7C.20 & 1.7C.22A):
     * - Derives strictly from PostgreSQL database via Laravel Order domain.
     * - Never fabricates synthetic seed orders.
     * - Returns sanitized DTO conforming to Next.js Admin BFF expectations.
     *
     * @return array{orders: array<int, array<string, mixed>>, metrics: array<string, mixed>}
     */
    public function listOrders(?string $status = null, ?string $search = null): array
    {
        $query = Order::with(['lines.productVariant.product', 'customer'])
            ->orderBy('created_at', 'desc');

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

        $orders = $query->get();

        $sanitizedOrders = [];
        foreach ($orders as $order) {
            $sanitizedOrders[] = $this->mapOrderToDto($order);
        }

        $metrics = $this->calculateMetrics();

        return [
            'orders' => $sanitizedOrders,
            'metrics' => $metrics,
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

        return $this->mapOrderToDto($order);
    }

    /**
     * Map Eloquent Order model to sanitized AdminOrderRecord DTO.
     *
     * @return array<string, mixed>
     */
    public function mapOrderToDto(Order $order): array
    {
        $items = [];
        foreach ($order->lines as $line) {
            $variant = $line->productVariant;
            $product = $variant?->product;

            $items[] = [
                'product_name' => $product?->name ?? 'Callme Yoghurt',
                'variant' => $variant?->variant_name ?? ($variant?->sku ?? 'Standard'),
                'quantity' => (int) $line->quantity,
                'price' => (int) $line->unit_price,
            ];
        }

        $frontendStatus = $this->mapOrderStatusToFrontend($order->status);

        // Derive authoritative reservation evidence from PostgreSQL
        $lineIds = $order->lines->pluck('id')->map(fn ($id) => (string) $id)->all();
        $reservation = null;
        if (!empty($lineIds)) {
            $reservation = StockReservation::where('reference_type', 'ORDER_LINE')
                ->whereIn('reference_id', $lineIds)
                ->first();
        }
        if ($reservation === null) {
            $reservation = StockReservation::where('reference_type', 'ORDER')
                ->where('reference_id', (string) $order->id)
                ->first();
        }

        $reservationStatus = $reservation ? (string) $reservation->status : 'PENDING';
        $reservationSummaryStatus = $reservation ? (string) $reservation->status : 'PENDING';
        $reservationId = $reservation ? (string) $reservation->id : '';

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
                'reservation_id' => $reservationId,
                'status' => $reservationStatus,
                'summary_status' => $reservationSummaryStatus,
                'items' => [],
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
     * Metric Definitions (Phase 1.7C.22A):
     * - today_orders: Orders created since midnight today.
     * - waiting_payment: Orders confirmed but pending manual QRIS verification.
     * - completed_orders: Orders marked as DONE in ERP lifecycle.
     * - cancelled_orders: Orders voided or cancelled.
     * - gross_order_value (GOV): Total monetary sum of all valid active/completed orders.
     * - pending_payments_value: Outstanding monetary sum for unverified orders.
     * - settled_revenue: Realized monetary sum verified by merchant payment authority (0 in Manual QRIS without settlement ledger).
     * - recognized_revenue: Realized revenue verified after delivery confirmation (0 without proof).
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

        // Outstanding / Pending Payments Value
        $pendingPaymentsValue = (int) Order::where('status', OrderStatus::CONFIRMED)
            ->sum('total_amount');

        return [
            'today_orders' => $todayOrders,
            'waiting_payment' => $waitingPayment,
            'processing' => 0,
            'ready_to_ship' => 0,
            'completed_orders' => $completedOrders,
            'cancelled_orders' => $cancelledOrders,
            'gross_order_value' => $grossOrderValue,
            'pending_payments_value' => $pendingPaymentsValue,
            'settled_revenue' => 0,
            'recognized_revenue' => 0,
            'total_revenue' => $grossOrderValue,
        ];
    }
}
