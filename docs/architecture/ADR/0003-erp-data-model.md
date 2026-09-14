# ADR-0003 — Canonical ERP Data Model & Prisma Reconciliation

- Status: Accepted for Phase 0 (Gate 0D.1)
- Date: 2026-09-13
- Scope: Callme Yoghurt Canonical ERP Data Model Foundation
- References: ADR-0001 (Foundation Architecture), ADR-0002 (Laravel Runtime Lifecycle), `prisma/schema.prisma`

## Context

Phase 0 exploration previously produced a prototype schema in `prisma/schema.prisma`. While useful for initial domain discovery, that prototype exhibited several fundamental architectural shortcomings:
1. **Conflation of Product and Inventory Item**: Customer-facing attributes (slug, description, brand color, public availability) were stored directly on `Item`, preventing clean separation between sellable variants (e.g. 250ml vs 1L) and underlying finished goods, raw materials, or packaging.
2. **Float Quantities**: Inventory movements, BOM component ratios, and order quantities used IEEE 754 floating-point types (`Float`), risking rounding errors and ledger drift.
3. **Floating-Point/Ambiguous Money**: Order lines and totals lacked strict minor-unit monetary guarantees.
4. **Duplicate and Mutable Stock Truth**: `StockBatch` maintained a mutable `quantity` column alongside a mutable `StockMove` table, creating competing sources of truth and enabling race conditions and untraceable modifications.
5. **Broken Relational Ownership**: `OrderLine` stored a loose `itemId` string without strict variant foreign key constraints.

ADR-0001 established Laravel ERP Core with PostgreSQL as the sole authoritative transactional system of record. ADR-0003 defines the canonical, relational data model in Laravel/PostgreSQL to replace the prototype exploration.

## Decisions

### 1. Separation of Product, Variant, and Inventory Item

The domain separates customer catalog presentation from stock-controlled inventory:
```text
Product (Catalog)
   └── ProductVariant (Sellable SKU)
            └── InventoryItem (Stock-Controlled Material)
```
- **`Product`** (`products`): Represents the customer-facing product family (e.g. "Callme Strawberry Yoghurt"). Holds customer-facing attributes: `id` (UUID), `name`, `slug` (unique), `description`, `active`.
- **`ProductVariant`** (`product_variants`): Represents the sellable SKU/package (e.g. "Strawberry 250ml", SKU `CY-STR-250`). Holds: `id` (UUID), `product_id` (FK), `inventory_item_id` (FK), `sku` (unique), `variant_name`, `net_content_quantity` (`NUMERIC(18,6)`), `net_content_uom_id` (FK), `active`.
- **`InventoryItem`** (`inventory_items`): Represents stock-controlled physical items. Holds: `id` (UUID), `code` (unique), `name`, `type` (`ItemType` enum: `RAW_MATERIAL`, `PACKAGING`, `FINISHED_GOOD`), `base_uom_id` (FK), `lot_tracked` (boolean), `active` (boolean).

### 2. Unit of Measure (UOM) Foundation

Authoritative UOMs are stored in `units_of_measure`:
- `id` (UUID), `code` (unique string, e.g. `ML`, `L`, `G`, `KG`, `PCS`), `name`, `category` (optional, e.g. `VOLUME`, `WEIGHT`, `UNIT`).
- All inventory items reference a `base_uom_id`.

### 3. Bill of Materials (BOM) Precision

BOM structures are defined in `bills_of_materials` and `bill_of_material_components`:
- `BillOfMaterial`: `id` (UUID), `code` (unique), `finished_inventory_item_id` (FK), `version`, `active`.
- `BillOfMaterialComponent`: `id` (UUID), `bill_of_material_id` (FK), `component_inventory_item_id` (FK), `quantity` (`NUMERIC(18,6)`).
- Strict rule: Precision-sensitive physical quantities must always use PostgreSQL `NUMERIC(18,6)`, never IEEE 754 `Float` or `Double`.

### 4. Warehouses and Batch / Lot Traceability

- **`Warehouse`** (`warehouses`): `id` (UUID), `code` (unique, e.g. `WH-MAIN`, `COLD-ROOM-01`), `name`, `active`.
- **`InventoryLot`** (`inventory_lots`): `id` (UUID), `inventory_item_id` (FK), `lot_number`, `production_date` (nullable date), `expiration_date` (nullable date), `received_at` (nullable timestamp).
- **Single Source of Truth Invariant**: `InventoryLot` contains **NO mutable `quantity` column**. Lot balance is strictly a projection derived from the stock ledger.
- Constraint: Compound unique index on `(inventory_item_id, lot_number)`.

### 5. Append-Oriented Stock Ledger

Stock movements are recorded strictly via append-only ledger entries in `stock_ledger_entries`:
- `id` (UUID), `inventory_item_id` (FK), `warehouse_id` (FK), `inventory_lot_id` (nullable FK), `quantity_delta` (`NUMERIC(18,6)` signed), `event_type`, `reference_type`, `reference_id`, `correlation_id` (UUID nullable), `occurred_at`, `created_at`.
- **Signed Delta**: Receipts and production outputs are positive (+); sales and consumption are negative (-).
- **Transfers**: Inter-warehouse transfers are represented by two correlated entries linked by `correlation_id` (one negative from source, one positive into destination).
- **Immutability Invariant**: Ledger rows cannot be updated or deleted. Corrections require offsetting adjustment entries. Model lifecycle hooks reject any update or delete operation with a `RuntimeException`. Zero-quantity delta entries are rejected upon creation.
- **Relational Integrity**: Foreign keys for `inventory_item_id`, `warehouse_id`, and `inventory_lot_id` use `RESTRICT` on delete, ensuring historical audit trails cannot be deleted via cascading deletes.

### 6. Stock Reservations and Allocations (FEFO Preparation)

- **`StockReservation`** (`stock_reservations`): Binds requested item quantity for a business order/reference without moving ledger stock (`id`, `inventory_item_id`, `warehouse_id`, `reference_type`, `reference_id`, `quantity`, `status`, `expires_at`).
- **`StockAllocation`** (`stock_allocations`): Allocates reserved stock to specific lots (`id`, `stock_reservation_id` FK cascade, `inventory_lot_id` FK restrict, `quantity` `NUMERIC(18,6)`).
- Relational constraints prevent orphan allocations.

### 7. Orders and Relational Order Lines

- **`Order`** (`orders`): `id` (UUID), `order_number` (unique), `customer_id` (nullable FK to `customers`), `status` (`OrderStatus` enum: `DRAFT`, `CONFIRMED`, `DONE`, `CANCELLED`), `total_amount` (`BIGINT`).
- **`OrderLine`** (`order_lines`): `id` (UUID), `order_id` (FK cascade), `product_variant_id` (FK restrict), `quantity` (`NUMERIC(18,6)`), `unit_price` (`BIGINT`), `subtotal` (`BIGINT`).
- **Currency Invariant**: All monetary values in IDR are stored as integer `BIGINT` representing minor currency units (Rupiah), completely eliminating floating-point imprecision.

### 8. UUID Primary Keys

All newly introduced domain entities use UUID v4 primary keys (`HasUuids` trait in Eloquent) to prevent sequential ID enumeration and align with distributed service isolation. Existing Customer integer IDs remain unchanged to preserve Gate 0C stability.

## Prisma Reconciliation Matrix

| Prisma Entity / Field | ERP Core Status | Resolution & Architectural Justification |
| :--- | :--- | :--- |
| `UnitOfMeasure` | **ADOPTED** | Retained with UUID primary key, unique `code`, and descriptive `name`. |
| `Item` | **REPLACED** | Split into `Product` (customer catalog), `ProductVariant` (sellable SKU), and `InventoryItem` (physical inventory). Customer-facing fields (`slug`, `description`) moved to `Product`. |
| `ItemType` | **ADOPTED** | Retained as PHP native backed enum (`RAW_MATERIAL`, `PACKAGING`, `FINISHED_GOOD`). |
| `BillOfMaterial` | **ADOPTED** | Retained with UUID, unique code, finished inventory item FK, and versioning. |
| `BOMComponent.quantity` (`Float`) | **REPLACED** | Replaced with `NUMERIC(18,6)` to eliminate floating-point imprecision in manufacturing recipes. |
| `Warehouse` | **ADOPTED** | Retained with UUID and unique code. |
| `StockBatch.quantity` (`Float`) | **REJECTED** | Removed mutable `quantity` from lot table. Batch stock is derived solely from immutable ledger entries. |
| `StockMove` (mutable) | **REPLACED** | Replaced by append-only `StockLedgerEntry` with signed `quantity_delta` and model-level immutability enforcement. |
| `OrderLine.itemId` (string) | **REPLACED** | Replaced by formal relational foreign key to `product_variant_id` (`ProductVariant`). |
| `OrderLine.quantity` (`Float`) | **REPLACED** | Replaced with `NUMERIC(18,6)` decimal precision. |
| `Order.totalAmount` / `unitPrice` | **REPLACED** | Replaced with `BIGINT` integer minor units for IDR currency. |
| `Partner` | **DEFERRED** | Existing `Customer` entity satisfies current customer requirements; vendor/supplier entities deferred to procurement domain. |

## Consequences

### Positive
- Strict mathematical integrity for inventory quantities (`NUMERIC(18,6)`) and financials (`BIGINT`).
- Immutable, tamper-evident stock ledger prevents silent inventory modifications.
- Clear separation between sellable storefront products and physical inventory items.
- Full relational integrity on PostgreSQL with zero reliance on Prisma or MongoDB.

### Limits (Gate 0D.1 Boundary)
- Transaction workflows (checkout, reservation lock, FEFO selection, payment processing) are deferred to Gate 0E.
- Object storage metadata and data lifecycle retention policies are deferred to Gate 0D.2.
