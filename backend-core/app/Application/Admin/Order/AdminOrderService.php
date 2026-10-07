<?php

declare(strict_types=1);

namespace App\Application\Admin\Order;

use App\Domain\Sales\Enums\OrderStatus;
use App\Domain\Sales\Models\Order;
use Carbon\Carbon;

class AdminOrderService
{
    /**
     * List sanitized admin orders with optional status and search filters.
     *
     * Invariants (Phase 1.7C.20):
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
                'status' => $order->status === OrderStatus::DONE ? 'PAID' : ($order->status === OrderStatus::CANCELLED ? 'CANCELLED' : 'PENDING_PAYMENT'),
                'proof_status' => $order->status === OrderStatus::DONE ? 'verified' : 'waiting_verification',
            ],
            'order_status' => $frontendStatus,
            'delivery_method' => $order->shipping_courier
                ? trim("{$order->shipping_courier} {$order->shipping_service}")
                : ($order->delivery_method?->value ?? 'Next Day'),
            'inventory' => [
                'reservation_id' => '',
                'status' => 'RESERVED',
                'summary_status' => 'RESERVED',
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
            'WAITING_PAYMENT' => OrderStatus::CONFIRMED,
            'PAYMENT_CONFIRMED', 'PROCESSING', 'READY_TO_SHIP' => OrderStatus::CONFIRMED,
            'DELIVERED' => OrderStatus::DONE,
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
            OrderStatus::DONE => 'DELIVERED',
            OrderStatus::CANCELLED => 'CANCELLED',
        };
    }

    /**
     * Calculate summary KPI metrics from PostgreSQL orders table.
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
        $totalRevenue = (int) Order::whereIn('status', [OrderStatus::CONFIRMED, OrderStatus::DONE])
            ->sum('total_amount');

        return [
            'today_orders' => $todayOrders,
            'waiting_payment' => $waitingPayment,
            'processing' => 0,
            'ready_to_ship' => 0,
            'completed_orders' => $completedOrders,
            'cancelled_orders' => $cancelledOrders,
            'total_revenue' => $totalRevenue,
        ];
    }
}
