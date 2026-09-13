# ADR-0005 — Server-Authoritative Checkout Transaction Core

- Status: Accepted for Phase 0 (Gate 0E.1)
- Date: 2026-09-13
- Scope: Callme Yoghurt Checkout Transaction Core, Pricing, Inventory Reservation, and Idempotency
- References: ADR-0001 (Foundation Architecture), ADR-0002 (Laravel Runtime Lifecycle), ADR-0003 (ERP Data Model), ADR-0004 (Storage Lifecycle & Recovery)

## Context

In initial storefront prototypes, client browsers calculated product prices, cart subtotals, and order totals, passing them to frontend API routes. Furthermore, inventory stock checks were advisory, lot allocation was absent, and checkout operations lacked database-level atomicity, race condition serialization, and end-to-end idempotency.

Under ADR-0001 and ADR-0003, Laravel ERP Core backed by PostgreSQL is the authoritative transactional system of record. To prevent price tampering, overselling, race conditions, and ledger drift, this ADR formalizes Gate 0E.1: the server-authoritative checkout transaction core.

---

## Decisions

### 1. Transaction Authority Hierarchy

The Callme Yoghurt checkout flow enforces strict one-way authority:

```text
Browser Client
    ↓ (Product Variant IDs + Whole Quantities Only)
Next.js BFF
    ↓ (Authenticated Internal Service Request via Bearer Token)
Laravel ERP Core (POST /api/internal/orders)
    ↓ (Single Atomic PostgreSQL Transaction)
PostgreSQL Database
```

#### Authority Invariants:
- The browser and BFF are strictly forbidden from providing or asserting:
  - `price`, `unit_price`, `subtotal`, `total`, `total_amount`
  - `stock`, `warehouse`, `lot`, `inventory_lot_id`
  - `discount`, `order_status`
- Any request attempting to pass these fields at any level is rejected with HTTP 422 Unprocessable Entity.
- Laravel ERP Core and PostgreSQL are the sole authorities for:
  - Variant resolution and active catalog validation;
  - Retail unit price resolution;
  - Line subtotal and order total computation;
  - Customer identity resolution and encrypted shipping snapshots;
  - Fulfillment warehouse resolution;
  - Inventory availability derivation;
  - First-Expired, First-Out (FEFO) lot selection and row locking;
  - Stock reservation and allocation creation;
  - Order number generation and transaction-scoped idempotency.

---

### 2. Transaction Boundary & Atomicity

The checkout transaction executes inside a single PostgreSQL transaction (`DB::transaction`):

```text
[BEGIN PostgreSQL Transaction]
        ↓
1. Idempotency acquisition (INSERT ... ON CONFLICT DO NOTHING + SELECT ... FOR UPDATE)
        ↓
2. Request validation & canonicalization
        ↓
3. Fulfillment warehouse resolution (fail closed if missing/inactive)
        ↓
4. Customer resolution (pg_advisory_xact_lock on phone blind index)
        ↓
5. Variant resolution & row-locked price lookup (sorted by variant_id ASC)
        ↓
6. Order & OrderLine creation (with encrypted shipping snapshot)
        ↓
7. FEFO Inventory allocation with row locks (lockForUpdate on eligible lots)
        ↓
8. StockReservation & StockAllocation creation
        ↓
9. Idempotency key completion (link order_id)
        ↓
[COMMIT PostgreSQL Transaction]
```

#### Atomicity Guarantee:
If any step fails (e.g. inactive variant, missing price, insufficient inventory on any line, or concurrent request conflict), the entire transaction rolls back completely. Zero partial orders, zero partial order lines, zero reservations, and zero allocations remain.

---

### 3. Server-Authoritative Retail Pricing

Product prices are persisted in `product_variant_prices`:
- `id`: UUID Primary Key
- `product_variant_id`: UUID Foreign Key referencing `product_variants`
- `currency`: `CHAR(3)` (default `'IDR'`)
- `amount`: `BIGINT` (enforcing `CHECK (amount >= 0)`)
- `active`: `BOOLEAN` (default `true`)
- Partial Unique Index: `UNIQUE(product_variant_id, currency) WHERE active = true` guarantees exactly one active retail price per variant per currency.

#### Pricing Resolution:
- `CurrentVariantPriceResolver` loads the active price row with `lockForUpdate()` during checkout to prevent concurrent price modifications from splitting order lines across price snapshots.
- Both the `ProductVariant` and its underlying `InventoryItem` must be active (`active = true`).

---

### 4. Integer Rupiah Money Arithmetic

- All financial calculations are conducted exclusively in whole integer Rupiah (`BIGINT`).
- IEEE 754 floating-point numbers (`float`, `double`) and client-side rounding are strictly forbidden.
- For each order line:
  $$\text{subtotal} = \text{unit\_price} \times \text{quantity}$$
- Order total:
  $$\text{total\_amount} = \sum \text{subtotal}$$
- Database constraints enforce `CHECK (total_amount >= 0)` on `orders` and `CHECK (unit_price >= 0 AND subtotal >= 0 AND quantity > 0)` on `order_lines`.

---

### 5. Fulfillment Warehouse Scope

- Checkout inventory is scoped strictly to an authoritative fulfillment warehouse configured via:
  ```php
  config('inventory.fulfillment_warehouse_code') // via ERP_FULFILLMENT_WAREHOUSE_CODE
  ```
- **Fail-Closed Invariant**: There is NO default or fallback warehouse (such as `'WH-MAIN'`) in production code. If the configuration is missing, or if the configured warehouse does not exist or is inactive, checkout fails closed with HTTP 503 Service Unavailable.

---

### 6. Inventory Authority, Row Locking & FEFO Allocation

#### On-Hand and Availability Calculation:
Inventory stock is never read from cached counters or mutable batch tables. Availability is calculated dynamically from the immutable ledger and active reservations:
$$\text{on\_hand} = \sum_{\text{item, wh, lot}} \text{stock\_ledger\_entries.quantity\_delta}$$
$$\text{active\_reserved} = \sum_{\text{lot, active reservations}} \text{stock\_allocations.quantity}$$
$$\text{available} = \max(0, \lfloor \text{on\_hand} - \text{active\_reserved} \rfloor)$$

An active reservation is strictly defined as:
$$\text{status} = \text{'RESERVED'} \quad \text{AND} \quad (\text{expires\_at IS NULL} \lor \text{expires\_at} > \text{now()})$$
Reservations in status `RELEASED`, `CONSUMED`, `EXPIRED`, or `CANCELLED` do not reduce current available stock.

#### Deadlock Prevention & Row Locking:
- Multi-item checkout requests sort items deterministically by `variant_id ASC`.
- For each item, eligible lots in the fulfillment warehouse are queried and locked with PostgreSQL row locks:
  ```sql
  SELECT * FROM inventory_lots
  WHERE inventory_item_id = ? AND expiration_date >= ?
  ORDER BY expiration_date ASC, production_date ASC, received_at ASC, id ASC
  FOR UPDATE;
  ```
- **Allocation Writer Invariant**: Any service creating `stock_allocations` MUST first lock the relevant `inventory_lots` rows through `FefoInventoryReservationService`. `FefoInventoryReservationService` is the sole allocation writer in the checkout domain.

#### Expiry Semantics:
- Business dates are evaluated in the application timezone `Asia/Jakarta`.
- Lots with `expiration_date < business_today` are expired and ignored.
- Lots with `expiration_date >= business_today` are valid for FEFO allocation.
- Undated lots are excluded from finished-goods retail checkout.

#### Insufficient Stock:
If the sum of available whole units across all eligible lots is less than the requested quantity for any order line:
- Throws `InsufficientInventoryException`.
- The entire PostgreSQL transaction rolls back immediately.
- Returns HTTP 409 Conflict.

---

### 7. Customer Resolution & Concurrency

- Customer lookup uses the CRM PII blind index:
  $$\text{phone\_bindex} = \text{HMAC-SHA256}(\text{canonical\_phone}, \text{CRM\_PII\_BLIND\_INDEX\_KEY})$$
- To prevent concurrency races where two simultaneous checkouts for a new phone attempt duplicate customer insertion, the transaction acquires a transaction-scoped PostgreSQL advisory lock derived from the phone blind index:
  ```sql
  SELECT pg_advisory_xact_lock(?);
  ```
- If found, the existing customer is reused and their profile name/address is updated. If not found, a new `Customer` record is created with encrypted PII.
- `Order` stores an immutable, encrypted shipping snapshot (`shipping_name`, `shipping_phone`, `shipping_address`, `delivery_method`). Historical order fulfillment remains independent of future customer profile updates.

---

### 8. End-to-End Idempotency Boundary

Every checkout request must provide a valid `Idempotency-Key` header (max 200 characters).

Persisted in `checkout_idempotency_keys`:
- `id`: UUID Primary Key
- `scope`: `VARCHAR(50)` (`'checkout'`)
- `key_hash`: `CHAR(64)` ($\text{SHA-256}(\text{raw\_key})$)
- `request_hash`: `CHAR(64)` ($\text{HMAC-SHA256}(\text{canonical\_payload}, \text{CHECKOUT\_FINGERPRINT\_KEY})$)
- `order_id`: UUID nullable Foreign Key referencing `orders`
- `UNIQUE(scope, key_hash)`

#### Canonical Payload & HMAC Fingerprint:
- Canonical payload normalizes:
  - `customer.name`: trimmed string
  - `customer.whatsapp`: normalized canonical phone (e.g. `62812...`)
  - `customer.address`: trimmed string
  - `delivery_method`: lowercase string (`instant`, `sameday`, `nextday`)
  - `items`: sorted deterministically by `variant_id ASC`
- Request fingerprint is computed using a dedicated server secret `CHECKOUT_FINGERPRINT_KEY` via `config('checkout.fingerprint_key')` (fail-closed if missing).

#### Concurrency & Replay Algorithm:
1. `INSERT INTO checkout_idempotency_keys (id, scope, key_hash, request_hash, ...) VALUES (...) ON CONFLICT (scope, key_hash) DO NOTHING;`
2. `SELECT * FROM checkout_idempotency_keys WHERE scope = 'checkout' AND key_hash = ? FOR UPDATE;`
3. If row exists with `order_id IS NOT NULL`:
   - If `row.request_hash === request_fingerprint`: Replay -> return existing committed order (HTTP 200).
   - If `row.request_hash !== request_fingerprint`: Mismatch -> return HTTP 409 Conflict.
4. If row was newly inserted (`order_id IS NULL`):
   - Proceed with checkout transaction.
   - Upon creating order, update `checkout_idempotency_keys.order_id`.
   - Return newly created order (HTTP 201).

---

### 9. Order Number & Public Response Contract

- Order numbers are generated explicitly:
  $$\text{CY-} \parallel \text{YYYYMMDD} \parallel \text{-} \parallel \text{ULID}$$
  (e.g. `CY-20260913-01J9X4...`, 38 chars $\le$ 50 max).
- Initial order status is `OrderStatus::CONFIRMED`.
- Public response format strictly adheres to BFF contract:
  ```json
  {
    "order_id": "uuid",
    "order_number": "CY-20260913-...",
    "status": "CONFIRMED",
    "total_amount": 120000
  }
  ```
- Public response contains zero customer PII, zero warehouse IDs, zero lot IDs, zero reservation IDs, and zero token or hash values.

---

## Consequences

### Positive
- Strict transactional authority: zero chance of client-side price tampering or arbitrary totals.
- Mathematical safety: zero float rounding issues in financial totals or whole-unit stock reservations.
- Concurrency safety: PostgreSQL row locks and transaction-scoped advisory locks serialize competing checkouts cleanly without deadlocks.
- Immutable historical shipping records decoupled from future CRM profile modifications.
- Reliable replay: network retries return identical order records without creating duplicate reservations.

### Limits (Gate 0E.1 Boundary)
- Frontend checkout UI cutover is deferred to Gate 0E.2.
- Payment gateway integration, shipping fee calculation, courier dispatch APIs, and physical ledger dispatch consumption are deferred to later operational gates.
