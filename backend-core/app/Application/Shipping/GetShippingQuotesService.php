<?php

declare(strict_types=1);

namespace App\Application\Shipping;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Inventory\Enums\ItemType;
use App\Domain\Inventory\Models\InventoryItem;
use App\Domain\Pricing\Exceptions\InactiveVariantException;
use App\Domain\Pricing\Services\CurrentVariantPriceResolver;
use App\Domain\Shipping\Contracts\ShippingRateProviderInterface;
use App\Domain\Shipping\Exceptions\UnmeasuredShippingWeightException;
use App\Domain\Shipping\Services\ColdChainPolicyService;
use App\Domain\Shipping\Services\DestinationNormalizationService;
use App\Infrastructure\Shipping\ShippingQuoteCacheStore;
use DateTimeInterface;
use Illuminate\Support\Str;

class GetShippingQuotesService
{
    public function __construct(
        protected ShippingRateProviderInterface $rateProvider,
        protected ColdChainPolicyService $coldChainPolicy,
        protected CurrentVariantPriceResolver $priceResolver
    ) {}

    /**
     * Compute authoritative shipping quotes for cart items and destination.
     *
     * Invariants:
     * - Browser NEVER sends authoritative weight or product value.
     * - ERP resolves ProductVariant, active retail price, and shipping_weight_grams from DB.
     * - If any variant has shipping_weight_grams === null, fails closed (UnmeasuredShippingWeightException).
     * - Filters rates through ColdChainPolicyService (SOP 01).
     * - Issues opaque server-generated UUID quote_id stored in Cache/Redis with bounded TTL.
     *
     * @param array<string, mixed> $destination
     * @param array<int, array{variant_id: string, quantity: int}> $items
     * @param DateTimeInterface|null $referenceTime
     * @return array{
     *     quotes: array<int, array<string, mixed>>,
     *     service_fee: array{is_configured: bool, amount: int|null, name: string},
     *     storage_warning: string
     * }
     */
    public function execute(array $destination, array $items, ?DateTimeInterface $referenceTime = null): array
    {
        // 1. Sort items deterministically by variant_id ASC
        $canonicalItems = [];
        foreach ($items as $item) {
            $row = [
                'quantity' => (int) $item['quantity'],
                'variant_id' => strtolower(trim((string) $item['variant_id'])),
            ];
            ksort($row);
            $canonicalItems[] = $row;
        }
        usort($canonicalItems, fn($a, $b) => strcmp($a['variant_id'], $b['variant_id']));

        // Compute cart and destination fingerprints (Sections 4 & 7)
        $cartFingerprint = hash('sha256', json_encode($canonicalItems, JSON_THROW_ON_ERROR));

        $normalizedDestination = DestinationNormalizationService::normalize($destination);
        $destinationFingerprint = DestinationNormalizationService::computeFingerprint($destination);

        // 2. Resolve variants, prices, and shipping weights from PostgreSQL
        $resolvedBiteshipItems = [];
        $totalWeightGrams = 0;
        $productSubtotal = 0;
        $linePrices = [];

        foreach ($canonicalItems as $line) {
            /** @var ProductVariant|null $variant */
            $variant = ProductVariant::query()->find($line['variant_id']);
            if ($variant === null || !$variant->active) {
                throw new InactiveVariantException("Variant [{$line['variant_id']}] is inactive or does not exist.");
            }

            /** @var Product|null $product */
            $product = Product::query()->where('id', $variant->product_id)->first();
            if ($product === null || !$product->active) {
                throw new InactiveVariantException("Product family for variant [{$line['variant_id']}] is inactive or missing.");
            }

            /** @var InventoryItem|null $inventoryItem */
            $inventoryItem = InventoryItem::query()->where('id', $variant->inventory_item_id)->first();
            if ($inventoryItem === null || !$inventoryItem->active || $inventoryItem->type !== ItemType::FINISHED_GOOD) {
                throw new InactiveVariantException("Inventory item for variant [{$line['variant_id']}] is unavailable for checkout.");
            }

            // CRITICAL DOMAIN RULE: shipping_weight_grams MUST be measured. NULL or <=0 fails closed!
            if ($variant->shipping_weight_grams === null || $variant->shipping_weight_grams <= 0) {
                throw new UnmeasuredShippingWeightException(
                    "Berat pengiriman resmi belum ditimbang untuk varian '{$variant->sku}'. Pengambilan tarif logistik diblokir."
                );
            }

            $variant->setRelation('product', $product);
            $variant->setRelation('inventoryItem', $inventoryItem);

            $unitPrice = $this->priceResolver->resolvePrice($variant, 'IDR', lockRow: false);
            $lineSubtotal = $unitPrice * $line['quantity'];
            $productSubtotal += $lineSubtotal;
            $priceRow = [
                'quantity' => $line['quantity'],
                'subtotal' => $lineSubtotal,
                'unit_price' => $unitPrice,
                'variant_id' => $line['variant_id'],
            ];
            ksort($priceRow);
            $linePrices[] = $priceRow;

            $itemWeight = $variant->shipping_weight_grams * $line['quantity'];
            $totalWeightGrams += $itemWeight;

            $resolvedBiteshipItems[] = [
                'name' => $product->name . ' - ' . $variant->net_content_display,
                'value' => $unitPrice,
                'quantity' => $line['quantity'],
                'weight_grams' => $variant->shipping_weight_grams,
            ];
        }

        $priceFingerprint = hash('sha256', json_encode($linePrices, JSON_THROW_ON_ERROR));

        // 3. Resolve authoritative service fee from ERP configuration
        $rawServiceFee = config('shipping.service_fee_idr');
        $serviceFeeConfig = [
            'is_configured' => $rawServiceFee !== null,
            'amount' => $rawServiceFee !== null ? (int) $rawServiceFee : null,
            'name' => 'Biaya Layanan',
        ];

        // 4. Query Biteship Rates API via provider
        $origin = config('shipping.origin');
        $rawRates = $this->rateProvider->getRates($origin, $normalizedDestination, $resolvedBiteshipItems);

        // 5. Apply Cold Chain & SOP 01 Time-Gating Policy
        $compliantRates = $this->coldChainPolicy->filterRates($rawRates, $normalizedDestination, $referenceTime);

        // 6. Generate Opaque Server-Side Quotes & store in Cache/Redis with TTL
        $quoteStore = ShippingQuoteCacheStore::getStore();
        $ttlSeconds = (int) config('shipping.quote_ttl_seconds', 900);
        $quotes = [];

        foreach ($compliantRates as $rate) {
            $quoteId = (string) Str::uuid();
            $quotedAmount = (int) $rate['price'];
            $serviceFeeAmount = $serviceFeeConfig['amount']; // null if unconfigured
            $serviceFeeVal = $serviceFeeAmount ?? 0;
            $payableTotal = $productSubtotal + $quotedAmount + $serviceFeeVal;

            $quoteRecord = [
                'quote_id' => $quoteId,
                'cart_fingerprint' => $cartFingerprint,
                'destination_fingerprint' => $destinationFingerprint,
                'price_fingerprint' => $priceFingerprint,
                'product_subtotal' => $productSubtotal,
                'courier_code' => $rate['courier_code'],
                'courier_name' => $rate['courier_name'],
                'service_code' => $rate['service_code'],
                'service_name' => $rate['service_name'],
                'service_type' => $rate['service_type'],
                'quoted_amount' => $quotedAmount,
                'service_fee_amount' => $serviceFeeConfig['amount'], // null if unconfigured
                'payable_total' => $payableTotal,
                'duration' => $rate['duration'],
                'created_at' => now()->timestamp,
                'expires_at' => now()->addSeconds($ttlSeconds)->timestamp,
            ];

            // Cache ephemeral quote state bound to cart, destination & price
            $quoteStore->put("shipping_quote:{$quoteId}", $quoteRecord, $ttlSeconds);

            $quotes[] = [
                'quote_id' => $quoteId,
                'provider' => 'Biteship',
                'courier_name' => $rate['courier_name'],
                'courier_code' => $rate['courier_code'],
                'service_name' => $rate['service_name'],
                'service_code' => $rate['service_code'],
                'service_type' => $rate['service_type'],
                'product_subtotal' => $productSubtotal,
                'shipping_fee' => $quotedAmount,
                'service_fee' => $serviceFeeConfig['amount'],
                'payable_total' => $payableTotal,
                'price' => $quotedAmount,
                'total_price' => $quotedAmount + $serviceFeeVal,
                'duration' => $rate['duration'],
                'cold_chain_compliant' => true,
                'description' => $rate['description'],
                'storage_warning' => $rate['storage_warning'],
                'is_same_day_dispatch' => $rate['is_same_day_dispatch'],
                'dispatch_date' => $rate['dispatch_date'],
                'dispatch_note' => $rate['dispatch_note'],
                'expires_at' => $quoteRecord['expires_at'],
            ];
        }

        return [
            'quotes' => $quotes,
            'service_fee' => $serviceFeeConfig,
            'storage_warning' => ColdChainPolicyService::MANDATORY_STORAGE_WARNING,
        ];
    }
}
