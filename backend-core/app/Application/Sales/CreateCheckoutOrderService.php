<?php

declare(strict_types=1);

namespace App\Application\Sales;

use App\Domain\CRM\Models\Customer;
use App\Domain\CRM\Services\PhoneBlindIndexService;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Exceptions\FulfillmentWarehouseUnavailableException;
use App\Domain\Inventory\Models\Warehouse;
use App\Domain\Inventory\Services\FefoInventoryReservationService;
use App\Domain\Pricing\Exceptions\InactiveVariantException;
use App\Domain\Pricing\Services\CurrentVariantPriceResolver;
use App\Domain\Sales\Enums\DeliveryMethod;
use App\Domain\Sales\Enums\OrderStatus;
use App\Domain\Sales\Exceptions\IdempotencyConflictException;
use App\Domain\Sales\Models\CheckoutIdempotencyKey;
use App\Domain\Sales\Models\Order;
use App\Domain\Sales\Models\OrderLine;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class CreateCheckoutOrderService
{
    public function __construct(
        protected CurrentVariantPriceResolver $priceResolver,
        protected FefoInventoryReservationService $reservationService
    ) {}

    /**
     * Execute atomic checkout transaction.
     *
     * @param array{
     *     customer: array{name: string, whatsapp: string, address: string},
     *     items: array<int, array{variant_id: string, quantity: int}>,
     *     delivery_method: string
     * } $validatedData
     * @param string $rawIdempotencyKey
     * @return array{order: Order, is_replay: bool}
     */
    public function execute(array $validatedData, string $rawIdempotencyKey): array
    {
        // 1. Resolve fingerprint secret key (fails closed)
        $fingerprintKey = config('checkout.fingerprint_key');
        if (!is_string($fingerprintKey) || $fingerprintKey === '') {
            throw new RuntimeException('Checkout fingerprint key is not configured. Failing closed.');
        }

        // 2. Canonicalize payload and calculate request fingerprint with explicit JSON flags
        $canonicalPayload = $this->canonicalizePayload($validatedData);
        $encoded = json_encode(
            $canonicalPayload,
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
        $requestFingerprint = hash_hmac('sha256', $encoded, $fingerprintKey);
        $keyHash = hash('sha256', $rawIdempotencyKey);

        // 3. Execute everything inside a single PostgreSQL transaction
        return DB::transaction(function () use ($canonicalPayload, $requestFingerprint, $keyHash) {
            // Step A: Idempotency acquisition capturing RETURNING id to detect whether this tx inserted the row
            $insertedRows = DB::select(
                "INSERT INTO checkout_idempotency_keys (id, scope, key_hash, request_hash, order_id, created_at, updated_at)
                 VALUES (?, 'checkout', ?, ?, NULL, NOW(), NOW())
                 ON CONFLICT (scope, key_hash) DO NOTHING
                 RETURNING id",
                [(string) Str::uuid(), $keyHash, $requestFingerprint]
            );

            $wasInsertedByThisTx = !empty($insertedRows);

            /** @var CheckoutIdempotencyKey|null $idempotencyRecord */
            $idempotencyRecord = CheckoutIdempotencyKey::query()
                ->where('scope', 'checkout')
                ->where('key_hash', $keyHash)
                ->lockForUpdate()
                ->first();

            if ($idempotencyRecord === null) {
                throw new RuntimeException('Failed to acquire idempotency lock.');
            }

            if ($wasInsertedByThisTx) {
                // Row was newly inserted by this transaction -> proceed to normal checkout
            } else {
                // Pre-existing row:
                // 1. If payload fingerprint differs -> 409 Conflict
                if (!hash_equals($idempotencyRecord->request_hash, $requestFingerprint)) {
                    throw new IdempotencyConflictException(
                        'Idempotency key reused with different request payload.'
                    );
                }

                // 2. If committed order exists -> replay same order
                if ($idempotencyRecord->order_id !== null) {
                    $existingOrder = Order::with('lines')->find($idempotencyRecord->order_id);
                    if ($existingOrder !== null) {
                        return [
                            'order' => $existingOrder,
                            'is_replay' => true,
                        ];
                    }
                }

                // 3. Pre-existing row with order_id NULL and not inserted by this transaction:
                // Indicates competing in-flight request or previously interrupted transaction -> fail closed!
                throw new IdempotencyConflictException(
                    'Idempotency transaction is currently in progress or incomplete. Please retry later.'
                );
            }

            // Step B: Resolve and lock Fulfillment Warehouse (fail closed)
            $warehouseCode = config('inventory.fulfillment_warehouse_code');
            if (!is_string($warehouseCode) || $warehouseCode === '') {
                throw new FulfillmentWarehouseUnavailableException(
                    'Fulfillment warehouse configuration is unconfigured. Failing closed.'
                );
            }

            $warehouse = Warehouse::query()
                ->where('code', $warehouseCode)
                ->where('active', true)
                ->lockForUpdate()
                ->first();

            if ($warehouse === null) {
                throw new FulfillmentWarehouseUnavailableException(
                    "Fulfillment warehouse [{$warehouseCode}] is missing or inactive."
                );
            }

            // Step C: Customer Resolution with native PostgreSQL 64-bit advisory lock
            $canonicalCustomer = $canonicalPayload['customer'];
            $canonicalPhone = $canonicalCustomer['whatsapp'];
            $phoneBlindIndex = PhoneBlindIndexService::generateBlindIndex($canonicalPhone);

            // Native PostgreSQL 64-bit advisory lock derived from phone blind index
            DB::statement('SELECT pg_advisory_xact_lock(hashtextextended(?, 0))', [$phoneBlindIndex]);

            $customer = Customer::where('phone_bindex', $phoneBlindIndex)->first();
            if ($customer !== null) {
                // Update profile with latest customer details
                $customer->name = $canonicalCustomer['name'];
                $customer->address = $canonicalCustomer['address'];
                $customer->save();
            } else {
                $customer = new Customer();
                $customer->name = $canonicalCustomer['name'];
                $customer->address = $canonicalCustomer['address'];
                $customer->setPhoneWithBlindIndex($canonicalPhone);
                $customer->save();
            }

            // Step D: Resolve variants & active prices in deterministic order (deadlock avoidance)
            $sortedItems = $canonicalPayload['items']; // Already sorted by variant_id ASC in canonicalization
            $resolvedLines = [];
            $totalAmount = 0;

            foreach ($sortedItems as $item) {
                $variant = ProductVariant::query()
                    ->with(['product', 'inventoryItem'])
                    ->lockForUpdate()
                    ->find($item['variant_id']);

                if ($variant === null || !$variant->active) {
                    throw new InactiveVariantException("Variant [{$item['variant_id']}] is inactive or does not exist.");
                }

                if ($variant->product === null || !$variant->product->active) {
                    throw new InactiveVariantException("Product family for variant [{$item['variant_id']}] is inactive or missing.");
                }

                $inventoryItem = $variant->inventoryItem;
                if ($inventoryItem === null || !$inventoryItem->active) {
                    throw new InactiveVariantException("Inventory item for variant [{$item['variant_id']}] is inactive or missing.");
                }

                if ($inventoryItem->type !== ItemType::FINISHED_GOOD) {
                    throw new InactiveVariantException(
                        "Only FINISHED_GOOD items are sellable at checkout. Variant [{$item['variant_id']}] has item type [{$inventoryItem->type->value}]."
                    );
                }

                // Resolve authoritative retail price with row lock
                $unitPrice = $this->priceResolver->resolvePrice($variant, 'IDR', lockRow: true);
                $quantity = (int) $item['quantity'];

                // Integer overflow check before multiplication and addition
                if ($unitPrice > 0 && $quantity > intdiv(PHP_INT_MAX, $unitPrice)) {
                    throw new RuntimeException('Integer arithmetic overflow in line calculation.');
                }
                $subtotal = $unitPrice * $quantity;

                if (PHP_INT_MAX - $subtotal < $totalAmount) {
                    throw new RuntimeException('Integer arithmetic overflow in order total calculation.');
                }
                $totalAmount += $subtotal;

                $resolvedLines[] = [
                    'variant' => $variant,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'subtotal' => $subtotal,
                ];
            }

            // Step E: Create Order with encrypted shipping snapshot
            $order = Order::create([
                'order_number' => Order::generateOrderNumber(),
                'customer_id' => $customer->id,
                'shipping_name' => $canonicalCustomer['name'],
                'shipping_phone' => $canonicalCustomer['whatsapp'],
                'shipping_address' => $canonicalCustomer['address'],
                'delivery_method' => DeliveryMethod::from($canonicalPayload['delivery_method']),
                'status' => OrderStatus::CONFIRMED,
                'total_amount' => $totalAmount,
            ]);

            // Step F: Create OrderLines and reserve inventory via FEFO
            foreach ($resolvedLines as $lineData) {
                /** @var OrderLine $orderLine */
                $orderLine = OrderLine::create([
                    'order_id' => $order->id,
                    'product_variant_id' => $lineData['variant']->id,
                    'quantity' => $lineData['quantity'],
                    'unit_price' => $lineData['unit_price'],
                    'subtotal' => $lineData['subtotal'],
                ]);

                // Ensure relationship is available for reservation service
                $orderLine->setRelation('productVariant', $lineData['variant']);

                // FEFO inventory allocation with row locking (lockForUpdate)
                $this->reservationService->reserveOrderLine($orderLine, $warehouse);
            }

            // Step G: Link order to idempotency record
            $idempotencyRecord->order_id = $order->id;
            $idempotencyRecord->save();

            return [
                'order' => $order,
                'is_replay' => false,
            ];
        });
    }

    /**
     * Canonicalize request payload into stable structure.
     *
     * Invariants:
     * - Trims customer name and address strings.
     * - Normalizes phone via PhoneBlindIndexService::normalize.
     * - Normalizes delivery method.
     * - Sorts items deterministically by variant_id ASC (deadlock avoidance + replay equivalence).
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function canonicalizePayload(array $data): array
    {
        $rawCustomer = (array) ($data['customer'] ?? []);
        $canonicalCustomer = [
            'address' => trim((string) ($rawCustomer['address'] ?? '')),
            'name' => trim((string) ($rawCustomer['name'] ?? '')),
            'whatsapp' => PhoneBlindIndexService::normalize((string) ($rawCustomer['whatsapp'] ?? '')),
        ];
        ksort($canonicalCustomer);

        $rawItems = (array) ($data['items'] ?? []);
        $canonicalItems = [];
        foreach ($rawItems as $item) {
            $itemArr = (array) $item;
            $canonicalItems[] = [
                'quantity' => (int) ($itemArr['quantity'] ?? 0),
                'variant_id' => strtolower(trim((string) ($itemArr['variant_id'] ?? ''))),
            ];
        }

        // Deterministic item sort by variant_id ASC
        usort($canonicalItems, fn($a, $b) => strcmp($a['variant_id'], $b['variant_id']));

        $canonical = [
            'customer' => $canonicalCustomer,
            'delivery_method' => strtolower(trim((string) ($data['delivery_method'] ?? ''))),
            'items' => $canonicalItems,
        ];
        ksort($canonical);

        return $canonical;
    }
}
